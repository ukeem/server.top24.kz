/** @format */

import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Post } from "./models/post.model";
import puppeteer from "puppeteer";
import OpenAI from "openai";
import { Category } from "./models/category.model";
import { Query } from "./models/query.model";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

@Injectable()
export class PostsService {
    constructor(
        @InjectModel(Post)
        private postModel: typeof Post,
        @InjectModel(Category)
        private categoryModel: typeof Category,
        @InjectModel(Query)
        private queryModel: typeof Query,
        private readonly sequelize: Sequelize
    ) {}

    async addPosts() {
        const queries = await this.getQueries();

        const posts = await Promise.all(
            queries.map(async (query) => {
                const data = await this.getContent(query);
                if (!data || !data.title || !data.content) {
                    console.warn(
                        "Предупреждение: некорректные данные от getContent",
                        data
                    );
                    return null;
                }

                const { title, content } = data;
                const image = await this.getImage(query);
                const categoryId = await this.getCategoryId(content);

                if (!image) {
                    console.warn(
                        `Предупреждение: изображение отсутствует для "${title}"`
                    );
                    return null;
                }

                return this.postModel.create({
                    title,
                    content,
                    image,
                    categoryId,
                });
            })
        );

        return posts.filter(Boolean); // Убираем null-значения
    }

    private async getQueries() {
        const url =
            "https://trends.google.com/trending?geo=KZ&sort=search-volume&hours=24";
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-features=HttpsFirstBalancedModeAutoEnable",
            ],
        });
        const page = await browser.newPage();

        try {
            await page.goto(url, { waitUntil: "networkidle2" });

            const allQueries: string[] = await page.evaluate(() => {
                return Array.from(
                    document.querySelectorAll(".enOdEe-wZVHld-xMbwt")
                )
                    .map((item) => {
                        const content = item.querySelector(".mZ3RIc");
                        return content
                            ? (content as HTMLElement).innerText
                                  .trim()
                                  .toLowerCase()
                            : null;
                    })
                    .filter((text) => text !== null) as string[];
            });

            const newQueries: string[] = [];
            let q = 0;

            for (const query of allQueries) {
                if (q >= 1) break; // Ограничиваем 5 новыми заголовками
                const existingQuery = await this.queryModel.findOne({
                    where: { name: query },
                });

                if (!existingQuery) {
                    await this.queryModel.create({ name: query });
                    newQueries.push(query);
                    q++; // Увеличиваем счётчик
                }
            }

            console.log(newQueries);
            return newQueries;
        } catch (error) {
            console.error("Ошибка getQueries:", error);
            return [];
        } finally {
            await browser.close();
        }
    }

    private async getCategoryId(query: string) {
        const categories = await this.categoryModel.findAll();
        const categoryList = categories.map((c) => c.name).join("\n");
        const prompt = `
			Определи, к какой категории из списка относится контент: "${query}".  
			Если запрос не подходит ни к одной категории или список категорий пуст, придумай наиболее подходящее название категории.  
			Ответ должен содержать **только одно слово** — название категории, **без пояснений и комментариев**.  

			Примеры возможных категорий: Спорт, Финансы, Развлечения и т. д.  

			Список категорий:  
			${categoryList ? categoryList : "список пуст"}
		`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: {
                type: "text",
            },
            max_completion_tokens: 100,
        });

        const name = response.choices[0].message.content?.trim().toLowerCase();

        const [category] = await this.categoryModel.findOrCreate({
            where: { name },
            defaults: { name }, // Создаётся, если не найдена
        });

        return category.id;
    }

    private async getContent(query: string) {
        const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const cx = process.env.GOOGLE_SEARCH_CX;

        if (!apiKey || !cx) {
            console.error(
                "Ошибка: GOOGLE_SEARCH_API_KEY или GOOGLE_SEARCH_CX не установлены."
            );
            return null;
        }

        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(`${query} новости сегодня`)}&key=${apiKey}&cx=${cx}&num=5`;

        try {
            const response = await axios.get(url);

            if (!response.data.items) {
                console.warn(
                    "Предупреждение: Google API не вернул результатов."
                );
                return null;
            }

            const contentArray = await Promise.all(
                response.data.items.map(async (item: any) => {
                    try {
                        return await this.parseContent(item.link);
                    } catch (err) {
                        console.warn(
                            `Ошибка при разборе контента ${item.link}:`,
                            err
                        );
                        return null;
                    }
                })
            );

            // Фильтруем пустые значения
            const filteredContent = contentArray.filter(Boolean).join("\n");
            if (!filteredContent) {
                console.warn("Предупреждение: Не удалось получить контент.");
                return null;
            }

            const result = await this.rewriteContent(query, filteredContent);
            // console.log("Перезаписанный контент:", result);

            return result;
        } catch (error) {
            console.error("Ошибка при поиске:", error);
            return null;
        }
    }

    private async getImage(query: string): Promise<string | null> {
        const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const cx = process.env.GOOGLE_SEARCH_CX;

        if (!apiKey || !cx) {
            console.error(
                "Ошибка: GOOGLE_SEARCH_API_KEY или GOOGLE_SEARCH_CX не установлены."
            );
            return null;
        }

        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${cx}&searchType=image&num=5&key=${apiKey}`;

        try {
            const response = await axios.get(url);

            if (!response.data.items || response.data.items.length === 0) {
                console.warn("Нет изображений для сохранения.");
                return null;
            }

            // Проходим по 3 найденным изображениям
            for (let i = 0; i < Math.min(response.data.items.length, 10); i++) {
                const imageUrl = response.data.items[i]?.link;

                // Проверяем, что URL ведет на изображение (по расширению)
                if (imageUrl && /\.(jpg|jpeg|png|webp)$/i.test(imageUrl)) {
                    console.log(`✅ Выбрано изображение: ${imageUrl}`);
                    return await this.saveImage(imageUrl, query);
                } else {
                    console.warn(
                        `⚠️ Изображение #${i + 1} невалидно: ${imageUrl}`
                    );
                }
            }

            console.warn("❌ Не найдено ни одного валидного изображения.");
            return null;
        } catch (error: any) {
            console.error("Ошибка при получении изображения:", error.message);
            return null;
        }
    }

    private async saveImage(
        imageUrl: string,
        query: string
    ): Promise<string | null> {
        const imagesDir = path.join(__dirname, "..", "..", "images");
        const timestamp = Date.now();
        const fileName = `${query.replace(/\s+/g, "_")}_${timestamp}.webp`;
        const filePath = path.join(imagesDir, fileName);

        try {
            // Создаем папку images, если её нет
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            // Загружаем изображение
            const response = await axios.get(imageUrl, {
                responseType: "arraybuffer",
                validateStatus: (status) => status < 400,
            });

            const buffer = Buffer.from(response.data);

            // Преобразуем изображение в WebP
            await sharp(buffer)
                .resize(800, 400)
                .toFormat("webp") // Явно указываем формат
                .webp({ quality: 80 })
                .toFile(filePath);

            console.log(`✅ Изображение сохранено: ${filePath}`);
            return fileName;
        } catch (error: any) {
            console.error("Ошибка при сохранении изображения:", error.message);
            return null;
        }
    }

    private async parseContent(url: string) {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-features=HttpsFirstBalancedModeAutoEnable",
            ],
        });
        const page = await browser.newPage();

        try {
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
            );

            const response = await page.goto(url, {
                waitUntil: "load",
                timeout: 90000,
            });

            if (!response || !response.ok()) {
                console.error(
                    `Ошибка загрузки: ${response?.status()} ${response?.statusText()}`
                );
                return "";
            }

            // Альтернативный `waitForTimeout`
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const content = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("p"))
                    .map((p) => p.innerText.trim())
                    .filter((text) => text.length > 0)
                    .join("\n");
            });

            return content.replace(/\s{2,}/g, " ").trim();
        } catch (error) {
            console.error("Ошибка parseContent:", error);
            return "";
        } finally {
            await browser.close();
        }
    }

    private async rewriteContent(query: string, content: string) {
        const now = new Date();

        const prompt = `
			**Формат вывода:** Markdown (Красивое форматирование).\n\n
			**Язык вывода:** Только русский.\n\n
			**Длина:** приближенная к 15000 токенам.\n\n

			Найди в тексте всю информацию, связанную **только** с запросом **"${query}"**, и перепиши её, **удалив лишнее** и обеспечив уникальность **90-100%**.\n\n
			Первым всегда выводи заголовок. Например: # Погода в Алматы. # для заголовка должно быть всегда

			**Качество контента:**\n
			- **Полезность** – текст должен решать проблемы читателя и отвечать на его вопросы.\n
			- **Уникальность** – исключить дублирование, текст не должен быть скопирован с других ресурсов.\n
			- **Грамотность** – отсутствие орфографических, пунктуационных и стилистических ошибок.\n
			- **Читаемость** – текст должен быть структурированным и легко восприниматься (использовать короткие абзацы, списки, подзаголовки).\n\n  

			**Исходный текст:**\n  
			${content}
		`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: {
                type: "text",
            },
            temperature: 1,
            max_completion_tokens: 16384,
            top_p: 1,
            frequency_penalty: 1,
            presence_penalty: 1,
        });

        return {
            title: `${now.toLocaleDateString("ru-RU")} - ${this.getFirstH1(response.choices[0].message.content?.trim() || "") || query}`,
            content: response.choices[0].message.content?.trim(),
        };
    }

    private getFirstH1(text: string) {
        const match = text.match(/^# (.+)$/m);
        return match ? match[1] : null;
    }

    async truncateQueries() {
        await this.queryModel.truncate();
    }

    async getPostsByCategoryId(id: number) {
        const posts = await this.postModel.findAll({
            where: { categoryId: id },
            order: [["createdAt", "DESC"]],
            include: ["category"],
        });
        return posts;
    }

    async getPostById(id: number) {
        const post = await this.postModel.findByPk(id, {
            include: ["category"],
        });

        if (post) {
            post.viewed += 1;
        }

        await post?.save();

        return post;
    }

    async getAllCategories() {
        return await this.categoryModel.findAll();
    }

    async getAllPosts() {
        return await this.postModel.findAll({
            include: ["category"],
        });
    }

    async getPostsByCategoryLimit() {
        const sqlQuery = `
            SELECT * FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY "createdAt" DESC) AS row_num
                FROM "Posts"
            ) t
            WHERE row_num <= 3;
        `;

        const posts = await this.sequelize.query(sqlQuery, {
            type: QueryTypes.SELECT,
            raw: true,
        });

        // Получаем полные данные с категориями
        return this.postModel.findAll({
            where: { id: posts.map((p: any) => p.id) },
            include: [{ model: Category }],
            order: [["createdAt", "DESC"]],
        });
    }

    async getPosts(page: number = 1, limit: number = 10, id: number) {
        const offset = (page - 1) * limit;
        const { rows: posts, count } = await this.postModel.findAndCountAll({
            where: { categoryId: id },
            limit,
            offset,
            order: [["createdAt", "DESC"]],
            include: ["category"],
        });

        return {
            posts,
            hasNextPage: offset + posts.length < count,
            nextPage: offset + posts.length < count ? page + 1 : null,
        };
    }

    async getCategories(page: number = 1, limit: number = 3) {
        const offset = (page - 1) * limit;
        const { rows: categories, count } =
            await this.categoryModel.findAndCountAll({
                limit,
                offset,
                order: [["name", "ASC"]],
            });

        return {
            categories,
            hasNextPage: offset + categories.length < count,
            nextPage: offset + categories.length < count ? page + 1 : null,
        };
    }

    async getAsidePosts() {
        return await this.postModel.findAll({
            include: ["category"],
            limit: 10,
            order: [["viewed", "DESC"]],
        });
    }
}

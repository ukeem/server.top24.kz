/** @format */

import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PostsService } from "./posts/posts.service";

@Injectable()
export class TasksService {
    constructor(private readonly postsService: PostsService) {}

    @Cron("0 15 */5 * * *") // Запуск каждые 3 часа
    async handleCron1() {
        console.log("⏳ Запуск addPosts()...");
        try {
            await this.postsService.addPosts();
            console.log("✅ addPosts() выполнен успешно.");
        } catch (error) {
            console.error("❌ Ошибка в addPosts():", error);
        }
    }

    @Cron("0 0 * * *") // Раз в день в полночь
    async handleCron2() {
        console.log("⏳ Запуск truncateQueries()...");
        try {
            await this.postsService.truncateQueries();
            console.log("✅ truncateQueries() выполнен успешно.");
        } catch (error) {
            console.error("❌ Ошибка в truncateQueries():", error);
        }
    }
}

/** @format */

import { Injectable, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PostsService } from "./posts/posts.service";

@Injectable()
export class TasksService implements OnModuleInit {
    constructor(private readonly postsService: PostsService) {}

    async onModuleInit() {
        console.log("🚀 Приложение запущено — выполняем addPosts()");
        try {
            await this.postsService.addPosts();
            console.log("✅ addPosts() выполнен успешно.");
        } catch (error) {
            console.error("❌ Ошибка в addPosts():", error);
        }
    }
}
// export class TasksService {
//     constructor(private readonly postsService: PostsService) {}

//     @Cron("30 * * * * *") // Запуск каждые 3 часа
//     async handleCron1() {
//         console.log("⏳ Запуск addPosts()...");
//         try {
//             await this.postsService.addPosts();
//             console.log("✅ addPosts() выполнен успешно.");
//         } catch (error) {
//             console.error("❌ Ошибка в addPosts():", error);
//         }
//     }

//     @Cron("0 0 * * *") // Раз в день в полночь
//     async handleCron2() {
//         console.log("⏳ Запуск truncateQueries()...");
//         try {
//             await this.postsService.truncateQueries();
//             console.log("✅ truncateQueries() выполнен успешно.");
//         } catch (error) {
//             console.error("❌ Ошибка в truncateQueries():", error);
//         }
//     }
// }

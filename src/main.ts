/** @format */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as path from "path";
import * as express from "express";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app
        .enableCors
        // 	{
        //     origin: [
        //         "https://top24.kz",
        //         "https://www.top24.kz",
        //         "http://localhost:3000",
        //     ], // Разрешаем запросы с фронтенда
        //     methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        //     allowedHeaders: "Content-Type, Authorization", // Разрешаем использование заголовков
        //     credentials: true, // Разрешаем передачу cookies (если нужно)
        // }
        ();

    app.setGlobalPrefix("api");
    // Делаем папку images доступной по /images
    app.use("/images", express.static(path.join(__dirname, "..", "images")));

    const port = process.env.PORT ?? 3000;
    await app.listen(port, () =>
        console.log(`Сервер запущен на порту ${port}`)
    );
}

bootstrap();

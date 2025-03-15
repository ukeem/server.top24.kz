/** @format */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SequelizeModule } from "@nestjs/sequelize";
import { PostsModule } from "./posts/posts.module";
import { Post } from "./posts/models/post.model";
import { Category } from "./posts/models/category.model";
import { Query } from "./posts/models/query.model";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksService } from "./tasks.service";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        SequelizeModule.forRoot({
            dialect: "postgres",
            host: "localhost",
            port: 5432,
            username: "postgres",
            password: "Kimxan110784",
            database: "portal",
            models: [Post, Category, Query],
            synchronize: true,
            autoLoadModels: true,
        }),
        ScheduleModule.forRoot(),
        PostsModule,
    ],
    controllers: [],
    providers: [TasksService],
})
export class AppModule {}

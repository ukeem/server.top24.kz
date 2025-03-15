/** @format */

import { Module } from "@nestjs/common";
import { PostsService } from "./posts.service";
import { PostsController } from "./posts.controller";
import { Post } from "./models/post.model";
import { SequelizeModule } from "@nestjs/sequelize";
import { Category } from "./models/category.model";
import { Query } from "./models/query.model";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        SequelizeModule.forFeature([Post, Category, Query]),
    ],
    controllers: [PostsController],
    providers: [PostsService],
    exports: [PostsService],
})
export class PostsModule {}

/** @format */

import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
} from "@nestjs/common";
import { PostsService } from "./posts.service";

@Controller("posts")
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @Get("aside")
    getAsidePosts() {
        return this.postsService.getAsidePosts();
    }

    @Get("cats")
    async getCategories(
        @Query("page") page: string,
        @Query("limit") limit: string
    ) {
        return this.postsService.getCategories(Number(page), Number(limit));
    }

    @Get("ltd")
    async getPosts(
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Query("id") id: string
    ) {
        return this.postsService.getPosts(
            Number(page),
            Number(limit),
            Number(id)
        );
    }

    @Get("category")
    getAllCategories() {
        return this.postsService.getAllCategories();
    }

    @Get("limited")
    getPostsByCategoryLimit() {
        return this.postsService.getPostsByCategoryLimit();
    }

    @Get()
    getAllPosts() {
        return this.postsService.getAllPosts();
    }

    @Get("category/:id")
    getPostsByCategoryId(@Param("id") id: string) {
        return this.postsService.getPostsByCategoryId(+id);
    }

    @Get(":id")
    getPostById(@Param("id") id: string) {
        return this.postsService.getPostById(+id);
    }
}

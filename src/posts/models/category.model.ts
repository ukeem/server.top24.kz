/** @format */

import { Column, HasMany, Model, Table, Unique } from "sequelize-typescript";
import { Post } from "./post.model";

@Table
export class Category extends Model {
    @Column({ unique: true })
    name: string;

    @HasMany(() => Post)
    posts: Post[];
}

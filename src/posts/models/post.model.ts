/** @format */

import {
    BelongsTo,
    Column,
    ForeignKey,
    Model,
    Table,
    Unique,
} from "sequelize-typescript";
import { Category } from "./category.model";

@Table
export class Post extends Model {
    @Unique
    @Column
    title: string;

    @Column({ type: "text" })
    content: string;

    @Column
    image: string;

    // @Unique
    @Column({
        defaultValue: 0,
    })
    viewed: number;

    @ForeignKey(() => Category)
    @Column
    categoryId: number;

    @BelongsTo(() => Category)
    category: Category;
}

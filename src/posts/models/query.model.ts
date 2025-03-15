/** @format */

import { Column, HasMany, Model, Table, Unique } from "sequelize-typescript";

@Table
export class Query extends Model {
    @Unique
    @Column
    name: string;
}

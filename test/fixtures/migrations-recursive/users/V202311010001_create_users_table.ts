import {MigrationInterface} from "../../../../src";

export default class implements MigrationInterface {
    async up(db: any): Promise<void> {
        // Create users table
    }

    async down(db: any): Promise<void> {
        // Drop users table
    }
}

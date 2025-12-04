import { expect } from 'chai';
import { IDB, IDatabaseMigrationHandler, IMigrationInfo, LoaderRegistry } from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

describe('MigrationScript', () => {
    /**
     * Test: MigrationScript<IDB> initialization loads the script content
     * Validates that the init() method dynamically loads the migration script
     * from the file system and makes it executable. The script property should
     * be undefined before init() and contain a runnable script with up() method after.
     * This lazy loading pattern is used to avoid loading all migrations into memory.
     */
    it('should load script content when init is called', async () => {
        // Create a MigrationScript object (script content not yet loaded)
        const ms = TestUtils.prepareMigration('V202311062345_valid.ts');
        expect(ms.script).is.undefined

        // Call init() to load the script content from the file using default loader registry
        const registry = LoaderRegistry.createDefault();
        await ms.init(registry);

        // Verify the script is now loaded and has a callable up() function
        expect(ms.script).not.undefined
        expect(typeof ms.script.up === 'function').is.true
        expect(await ms.script.up({ checkConnection: async () => true } as any, {} as IMigrationInfo, {} as IDatabaseMigrationHandler<IDB>)).eq('result string')
    })
})
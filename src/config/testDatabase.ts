
import "dotenv/config";
import pool from "./database";

async function testConnection() {
    try {
        const [rows] = await pool.query(
            "SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion"
        );

        console.log("Koneksi MySQL berhasil!");
        console.log(rows);
    } catch (error) {
        console.error("Koneksi MySQL gagal:", error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

void testConnection();

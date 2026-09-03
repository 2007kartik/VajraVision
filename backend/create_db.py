import asyncio
import asyncpg

async def create_db():
    print("Connecting to postgres...")
    # Connect to the default 'postgres' database to create a new one
    conn = await asyncpg.connect(user='postgres', password='Mahanor@2025', host='localhost', port=5432, database='postgres')
    print("Connected. Creating satquery_db...")
    try:
        # asyncpg connection cannot execute CREATE DATABASE inside a transaction block, 
        # but the default behavior might wrap it. Let's try raw execute with autocommit.
        # Actually asyncpg's execute uses prepared statements which can't run CREATE DATABASE.
        # It's better to use an engine or just run it via the connection pool or a bare connection.
        # But wait, asyncpg lets us do it if we are not in a transaction.
        pass
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

# Let's use standard connection string and sys.execute.
# asyncpg connection executes it fine if not in transaction.

async def run():
    sys_conn = await asyncpg.connect("postgresql://postgres:Mahanor%402025@localhost:5432/postgres")
    try:
        await sys_conn.execute("CREATE DATABASE satquery_db")
        print("Database 'satquery_db' created successfully.")
    except asyncpg.exceptions.DuplicateDatabaseError:
        print("Database 'satquery_db' already exists.")
    except Exception as e:
        print(f"Failed: {e}")
    finally:
        await sys_conn.close()

if __name__ == "__main__":
    asyncio.run(run())

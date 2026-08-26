
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

with open("db_check_log.txt", "w") as f:
    f.write(f"DATABASE_URL: {db_url}\n")
    try:
        conn = psycopg2.connect(db_url)
        f.write("Connection to psych_db successful.\n")
        conn.close()
    except psycopg2.OperationalError as e:
        if "does not exist" in str(e):
            f.write("Database 'psych_db' does not exist.\n")
        else:
            f.write(f"Error connecting to database: {e}\n")
    except Exception as e:
        f.write(f"An unexpected error occurred: {e}\n")
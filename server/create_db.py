
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
db_name = db_url.split("/")[-1]
db_url_nodatabase = db_url.replace(f"/{db_name}", "/postgres")

with open("create_db_log.txt", "w") as f:
    f.write(f"DATABASE_URL: {db_url}\n")
    f.write(f"DB_NAME: {db_name}\n")
    f.write(f"DB_URL_NODATABASE: {db_url_nodatabase}\n")
    try:
        conn = psycopg2.connect(db_url_nodatabase)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE {db_name}")
        f.write(f"Database '{db_name}' created successfully.\n")
        cursor.close()
        conn.close()
    except Exception as e:
        f.write(f"An error occurred: {e}\n")
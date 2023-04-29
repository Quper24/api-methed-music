import { createServer } from "http";
import fs from "fs/promises";

const DB_FILE = process.env.DB_FILE || "./db.json";
const PORT = process.env.PORT || 3024;
const URI_PREFIX = "/api/music";

class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (i === j) continue;
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

async function getItemsList(params = {}) {
  const db = shuffle(JSON.parse(await fs.readFile(DB_FILE, "utf8")) || []);

  if (params.search) {
    const search = params.search.trim().toLowerCase();
    return db.filter(
      (item) =>
        item.artist.toLowerCase().includes(search) ||
        item.track.toLowerCase().includes(search)
    );
  }

  return db;
}

async function getItems(itemId) {
  const data = JSON.parse(await fs.readFile(DB_FILE, "utf8")) || [];
  const item = data.find(({ id }) => id === itemId);
  if (!item) throw new ApiError(404, { message: "Item Not Found" });
  return item;
}
function notFound(res) {
  res.statusCode = 404;
  res.end(JSON.stringify({ message: "Not Found" }));
}

const server = createServer(async (req, res) => {
  if (req.url.substring(1, 4) === "img") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    const image = await fs.readFile(`.${req.url}`);
    res.end(image);
    return;
  }

  if (req.url.substring(1, 4) === "mp3") {
    res.statusCode = 200;
    const data = await fs.readFile(`.${req.url}`);
    const range = req.headers.range;
    const total = data.length;
    const parts = range.replace(/bytes=/, "").split("-");
    const partialstart = parts[0];
    const partialend = parts[1];
    const start = parseInt(partialstart, 10);
    const end = partialend ? parseInt(partialend, 10) : total - 1;
    const chunksize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "audio/mpeg",
    });
    res.end(data.slice(start, end + 1));
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.end();
    return;
  }

  // если URI не начинается с нужного префикса - можем сразу отдать 404
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    notFound(res);
    return;
  }

  const [uri, query] = req.url.substring(URI_PREFIX.length).split("?");
  const queryParams = {};

  if (query) {
    for (const piece of query.split("&")) {
      const [key, value] = piece.split("=");
      queryParams[key] = value ? decodeURIComponent(value) : "";
    }
  }

  try {
    const body = await (async () => {
      if (uri === "" || uri === "/") {
        if (req.method === "GET") return getItemsList(queryParams);
      } else {
        const itemId = uri.substring(1);
        if (req.method === "GET") return getItems(itemId);
      }
      return null;
    })();
    res.end(JSON.stringify(body));
  } catch (err) {
    console.log("err: ", err);
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "Server Error" }));
    }
  }
});

server.listen(PORT, () => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `Сервер mth.music запущен. Вы можете использовать его по адресу http://localhost:${PORT}`
    );
    console.log("Нажмите CTRL+C, чтобы остановить сервер");
    console.log("Доступные методы:");
    console.log(
      `GET ${URI_PREFIX}?{search=""} - поиск трека по исполнителю и названию`
    );
  }
});

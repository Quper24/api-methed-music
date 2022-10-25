// импорт стандартных библиотек Node.js
const {existsSync, mkdirSync, readFileSync, writeFileSync, writeFile, unlink} = require('fs');
const { createServer } = require("http");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, "db.json");
const PORT = process.env.PORT || 3024;
const URI_PREFIX = "/api/music";


class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}


function getItemsList(params = {}) {
  const db = JSON.parse(readFileSync(DB_FILE) || "{}");

  if (params.search) {
    const search = params.search.trim().toLowerCase();
    return db.filter(
      (item) =>
        item.artist.toLowerCase().includes(search) ||
        item.track.toLowerCase().includes(search)
    );
  }

  return db
}



function getItems(itemId) {
  const data = JSON.parse(readFileSync(DB_FILE) || "[]");
  const item = data.find(({ id }) => id === itemId);
  if (!item) throw new ApiError(404, { message: "Item Not Found" });
  return item;
}


module.exports = server = createServer(async (req, res) => {
  if (req.url.substring(1, 4) === "img") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    require("fs").readFile(`.${req.url}`, (err, image) => {
      res.end(image);
    });
    return;
  }

  if (req.url.substring(1, 4) === "mp3") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    require("fs").readFile(`.${req.url}`, (err, mp3) => {
      res.end(mp3);
    });
    return;
  }


  res.setHeader("Content-Type", "application/json");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.end();
    return;
  }


  // если URI не начинается с нужного префикса - можем сразу отдать 404
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: "Not Found" }));
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
})
  .on("listening", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `Сервер CRM запущен. Вы можете использовать его по адресу http://localhost:${PORT}`
      );
      console.log("Нажмите CTRL+C, чтобы остановить сервер");
      console.log("Доступные методы:");
      console.log(`GET ${URI_PREFIX} - получить список треков`);
      console.log(`GET ${URI_PREFIX}?{search=""} - поиск трека по исполнителю и названию`);
    }
  })
  .listen(PORT);

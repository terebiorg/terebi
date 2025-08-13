const { app, BrowserWindow, ipcMain } = require("electron");
const YouTubeCastReceiver = require("yt-cast-receiver");
const { Client } = require("@xhayper/discord-rpc");
const nodeDiskInfo = require("node-disk-info");
const { Player } = require("yt-cast-receiver");
const { Worker } = require("worker_threads");
const { Server } = require("socket.io");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const express = require("express");
const bcrypt = require("bcryptjs");
const mime = require("mime-types");
const qrcode = require("qrcode");
const dgram = require("dgram");
const path = require("path");
const cors = require("cors");
const http = require("http");
const fs = require("fs");

if (require("electron-squirrel-startup")) {
  app.quit();
}

const port = 9864;
const server = express();
const serverHttp = http.createServer(server);
const io = new Server(serverHttp);

let local_ip = null;
const s = dgram.createSocket("udp4");
s.connect(80, "8.8.8.8", () => {
  local_ip = s.address().address;
  console.log("[SERVER] Fetched local IP");
  s.close();
});

server.use(express.static("resources/static"));
server.use(express.json());
server.use(cors());

app.commandLine.appendSwitch("enable-features", "WebGPU");
app.commandLine.appendSwitch("enable-unsafe-webgpu");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: "icon.png",
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadURL(`http://127.0.0.1:${port}/index.html`);

  win.webContents.on("devtools-opened", () => {
    const css = `
    :root {
        --sys-color-base: var(--ref-palette-neutral100);
        --source-code-font-family: consolas;
        --source-code-font-size: 12px;
        --monospace-font-family: consolas;
        --monospace-font-size: 12px;
        --default-font-family: system-ui, sans-serif;
        --default-font-size: 12px;
    }
    .-theme-with-dark-background {
        --sys-color-base: var(--ref-palette-secondary25);
    }
    body {
        --default-font-family: system-ui,sans-serif;
    }`;
    win.webContents.devToolsWebContents.executeJavaScript(`
    const overriddenStyle = document.createElement('style');
    overriddenStyle.innerHTML = '${css.replaceAll("\n", " ")}';
    document.body.append(overriddenStyle);
    document.body.classList.remove('platform-windows');`);
  });
};

class SocketPlayer extends Player {
  constructor(socket) {
    super();
    this.socket = socket;
    this.volume = { level: 100, muted: false };
    this.position = 0;
    this.duration = 0;
  }
  doPause() {
    return new Promise((resolve, reject) => {
      console.log("pause");
      this.socket.emit("pause");
      resolve(true);
    });
  }
  doPlay(video, position) {
    return new Promise((resolve, reject) => {
      console.log("play", video);
      this.position = 0;
      this.socket.emit("play", video);
      resolve(true);
    });
  }
  doResume() {
    return new Promise((resolve, reject) => {
      console.log("resume");
      this.socket.emit("resume");
      resolve(true);
    });
  }
  doStop() {
    return new Promise((resolve, reject) => {
      console.log("stop");
      this.position = 0;
      this.socket.emit("stop");
      resolve(true);
    });
  }
  doSeek(position) {
    return new Promise((resolve, reject) => {
      console.log("seek", position);
      this.position = position;
      this.socket.emit("seek", position);
      resolve(true);
    });
  }
  doSetVolume(volume) {
    return new Promise((resolve, reject) => {
      console.log("volume", volume);
      this.volume = volume;
      this.socket.emit("volume", volume);
      resolve(true);
    });
  }
  doGetVolume() {
    return new Promise((resolve, reject) => {
      resolve(this.volume);
    });
  }
  doGetPosition() {
    return new Promise((resolve, reject) => {
      resolve(this.position);
    });
  }
  doGetDuration() {
    return new Promise((resolve, reject) => {
      resolve(this.duration);
    });
  }
  setDuration(duration) {
    // console.log(duration);
    this.duration = duration;
  }
  setPosition(position) {
    // console.log(position);
    this.position = position;
  }
  setVolume(volume) {
    this.volume = volume;
    return new Promise((resolve, reject) => {
      console.log("volume", volume);
      this.socket.emit("volume", volume);
      resolve(true);
    });
  }
  resetPosition() {
    this.position = 0;
  }
}

let client = new Client({
  clientId: "1278852361053405336",
});

client.on("ready", () => {
  console.log("[DISCORD] Cherry Tree TV is ready!");
  client.user?.setActivity({
    details: "Chillin' in the main menu",
    largeImageKey: "cherrylogo",
    largeImageText: "Cherry Tree TV",
  });
});

let reconnectionAttempts = 0,
  isReconnecting = false;
client.on("disconnected", () => {
  if (isReconnecting) {
    console.log(
      "[DISCORD] Not attempting to reconnect while another reconnection attempt is in progress.",
    );
    return;
  }
  console.log(
    "[DISCORD] Discord IPC disconnected. Reconnecting in 15 seconds...",
  );

  isReconnecting = true;
  let interval = setInterval(() => {
    reconnectionAttempts++;
    console.log(`[DISCORD] Trying to reconnect... ${reconnectionAttempts}/3`);
    client.destroy();
    client = new Client({
      clientId: "1278852361053405336",
    });
    if (reconnectionAttempts === 3) {
      console.log(
        "[DISCORD] Not reconnecting after 3 failed connection attempts.",
      );
      clearInterval(interval);
      reconnectionAttempts = 0;
      isReconnecting = false;
    }
  }, 15_000);
});

app.whenReady().then(() => {
  ffmpeg.setFfmpegPath("resources/bin/ffmpeg.exe");
  ffmpeg.setFfprobePath("resources/bin/ffprobe.exe");

  let userData = app.getPath("userData");
  console.log("userData", userData);

  if (!fs.existsSync(`${userData}/thumbnails/`)) {
    fs.mkdirSync(`${userData}/thumbnails/`);
  }

  let config = {
    pairToken: uuidv4(),
    remotes: {},
  };

  if (!fs.existsSync(`${userData}/config.json`)) {
    fs.writeFileSync(
      `${userData}/config.json`,
      JSON.stringify(config, null, 2),
    );
  }

  function saveConfig() {
    fs.writeFileSync(
      `${userData}/config.json`,
      JSON.stringify(config, null, 2),
    );
  }

  config = JSON.parse(fs.readFileSync(`${userData}/config.json`));
  console.log(config);

  client.login();
  io.on("connection", async (socket) => {
    console.log("connection attempt");
    const details = socket.handshake.auth;
    const player = new SocketPlayer(socket);
    const receiver = new YouTubeCastReceiver(player, {
      device: {
        name: details.name,
        screenName: details.screenName,
        brand: details.brand,
        model: details.model,
      },
    });
    receiver.on("senderConnect", (sender) => {
      socket.emit("clientConnected", sender);
    });
    receiver.on("senderDisconnect", (sender) => {
      socket.emit("clientDisconnect", sender);
    });
    try {
      await receiver.start();
      socket.emit("success");
    } catch (error) {
      socket.emit("error", error);
    }

    socket.on("volume", (volume) => {
      player.setVolume({ level: volume, muted: false });
    });
    socket.on("duration", (duration) => {
      player.setDuration(duration);
    });
    socket.on("position", (position) => {
      player.setPosition(position);
    });
    socket.on("finishedPlaying", async () => {
      player.resetPosition();
      await player.pause();
      await player.next();
    });
    socket.on("disconnect", async () => {
      console.log("App disconnected, closing receiver");
      try {
        await receiver.stop();
      } catch (error) {
        console.log("How the fuck does it have an error here!???");
        console.log(error);
      }
    });
  });
  server.get("/local_ip", (req, res) => {
    res.send(local_ip);
  });
  server.get("/qr", (req, res) => {
    qrcode.toDataURL(req.query["url"], (err, url) => {
      const buffer = Buffer.from(url.split(",")[1], "base64");
      res.setHeader("content-type", "image/png");
      res.send(buffer);
    });
  });
  server.get("/thumbnail", (req, res) => {
    const fPath = req.query.path;
    const fName = path.basename(fPath);
    if (!fPath) {
      res.status(500).send({
        error: true,
        error_msg: "Please provide file path.",
      });
      return;
    }
    fs.stat(fPath, (err, stats) => {
      if (err) {
        res.status(500).send({
          error: true,
          error_msg: "Error accessing file!",
        });
        return;
      }

      if (stats.isDirectory()) {
        res.status(500).send({
          error: true,
          error_msg: "This is a directory.",
        });
        return;
      }

      const mimeType = mime.lookup(fPath);
      if (!mimeType) {
        res.status(500).send({ error: true, error_msg: "Unknown mime type" });
        return;
      }

      if (!mimeType.includes("video")) {
        res.status(500).send({
          error: true,
          error_msg: "File must be a video",
        });
        return;
      }

      if (fs.existsSync(path.join(userData, `thumbnails/${fName}/tn.png`))) {
        res.sendFile(path.join(userData, `thumbnails/${fName}/tn.png`));
        return;
      }

      new ffmpeg(fPath)
        .on("end", () => {
          res.sendFile(path.join(userData, `thumbnails/${fName}/tn.png`));
          return;
        })
        .on("error", function (err, stdout, stderr) {
          console.log("Cannot process video: " + err.message);
          res.status(500).send({
            error: true,
            error_msg: err.message,
          });
          return;
        })
        .takeScreenshots(
          {
            count: 1,
            timemarks: ["50%"], // number of seconds
          },
          path.join(userData, `thumbnails/${fName}/`),
        );
    });
  });
  server.get("/drives", (req, res) => {
    console.log("[FILE] Requesting drives");
    nodeDiskInfo
      .getDiskInfo()
      .then((disks) => {
        let driveNames = [];
        disks.forEach((disk) => {
          driveNames.push(disk.mounted);
        });
        res.json(driveNames);
      })
      .catch((reason) => {
        res.status(500).send(reason);
      });
  });
  server.post("/list", (req, res) => {
    const dir = req.body.dir;
    console.log("[FILE] Requested directory:", dir);

    if (!dir) {
      return res
        .status(400)
        .json({ error: true, error_msg: "Please provide a directory path!" });
    }

    fs.stat(dir, (err, stats) => {
      if (err) {
        return res
          .status(400)
          .json({ error: true, error_msg: "Error accessing directory!" });
      }

      if (stats.isFile()) {
        return res
          .status(400)
          .json({ error: true, error_msg: "This is a file!" });
      }

      fs.readdir(dir, async (err, files) => {
        if (err) {
          return res
            .status(400)
            .json({ error: true, error_msg: "Error reading directory!" });
        }

        const respData = [];
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const fileStats = await fs.promises.stat(filePath);
            respData.push({
              name: file,
              type: fileStats.isFile() ? "file" : "folder",
              created: new Date(fileStats.ctime).getTime(),
              modified: new Date(fileStats.mtime).getTime(),
            });
          } catch (error) {
            console.error(`Error reading file ${file}: ${error.message}`);
          }
        }

        res.json(respData);
      });
    });
  });
  server.get("/getFile", (req, res) => {
    const fPath = req.query.path;
    console.log("[FILE] Requested file:", fPath);

    if (!fPath) {
      return res
        .status(400)
        .json({ error: true, error_msg: "Please provide a file path!" });
    }

    fs.stat(fPath, (err, stats) => {
      if (err) {
        return res
          .status(400)
          .json({ error: true, error_msg: "Error accessing file!" });
      }

      if (stats.isDirectory()) {
        return res
          .status(400)
          .json({ error: true, error_msg: "This is a directory!" });
      }

      const mimeType = mime.lookup(fPath);
      if (!mimeType) {
        return res
          .status(400)
          .json({ error: true, error_msg: "Unknown file type!" });
      }

      res.sendFile(fPath, { headers: { "Content-Type": mimeType } });
    });
  });
  server.use(express.static("public"));
  serverHttp.listen(port, () => {
    console.log(`[SERVER] Cherry Tree server listening on port ${port}`);
    createWindow();
  });

  // Electron IPC
  ipcMain.on("setRPC", (event, arg) => {
    client.user?.setActivity({
      state: arg.state,
      details: arg.details,
      endTimestamp: arg.endTimestamp,
      largeImageKey: "cherrylogo",
      largeImageText: "Cherry Tree TV",
      buttons: arg.button1 && [
        {
          label: arg.button1.label,
          url: arg.button1.url,
        },
      ],
    });
  });
});

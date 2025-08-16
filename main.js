const { app, BrowserWindow, ipcMain, dialog } = require("electron");
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
const child_process = require("child_process");

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

app.whenReady().then(async () => {
  ffmpeg.setFfmpegPath("resources/bin/ffmpeg.exe");
  ffmpeg.setFfprobePath("resources/bin/ffprobe.exe");

  // --- START: RECORDING LOGIC ---
  let recordingProcess = null;

  const recordingsBasePath = path.join(app.getPath("userData"), "Recordings");
  try {
    if (!fs.existsSync(recordingsBasePath)) {
      fs.mkdirSync(recordingsBasePath, { recursive: true });
      console.log(
        `[RECORDER] Created base recordings directory at: ${recordingsBasePath}`,
      );
    }
  } catch (error) {
    console.error(
      `[RECORDER] Failed to create base recordings directory:`,
      error,
    );
  }

  ipcMain.on("start-recording", (event, { streamUrl, channelName }) => {
    if (recordingProcess) {
      console.log("[RECORDER] Recording is already in progress.");
      return;
    }

    const sanitizedChannelName = channelName.replace(/[<>:"/\\|?*]/g, "_");
    const channelFolderPath = path.join(
      recordingsBasePath,
      sanitizedChannelName,
    );

    try {
      if (!fs.existsSync(channelFolderPath)) {
        fs.mkdirSync(channelFolderPath, { recursive: true });
      }
    } catch (error) {
      console.error(`[RECORDER] Failed to create channel directory:`, error);
      channelFolderPath = recordingsBasePath;
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
      now.getHours(),
    ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
      now.getSeconds(),
    ).padStart(2, "0")}`;
    const fileName = `${sanitizedChannelName}_${timestamp}.mp4`;
    const savePath = path.join(channelFolderPath, fileName);

    console.log(
      `[RECORDER] Starting HLS remux from ${streamUrl}, saving to: ${savePath}`,
    );

    const command = ffmpeg()
      .input(streamUrl)
      .inputOptions([
        "-user_agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      ])
      .videoCodec("copy")
      .audioCodec("copy")
      .outputOptions([
        "-bsf:a",
        "aac_adtstoasc",
        "-movflags",
        "frag_keyframe+empty_moov",
      ])
      .toFormat("mp4")
      .output(savePath);

    const args = command._getArguments();

    recordingProcess = child_process.spawn("resources/bin/ffmpeg.exe", args);

    recordingProcess.on("close", (code) => {
      if (code === 0 || code === 255) {
        console.log("[RECORDER] Recording finished successfully.");
      } else {
        console.error(`[RECORDER] ffmpeg process exited with code ${code}.`);
      }
      recordingProcess = null;
    });

    recordingProcess.on("error", (err) => {
      console.error("[RECORDER] Failed to start ffmpeg process:", err);
      recordingProcess = null;
    });

    recordingProcess.stderr.on("data", (data) => {
      console.log(`ffmpeg stderr: ${data}`);
    });
  });

  ipcMain.on("stop-recording", () => {
    if (recordingProcess) {
      console.log("[RECORDER] Stopping recording...");
      recordingProcess.stdin.write("q");
    }
  });
  // --- END: RECORDING LOGIC ---

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

  // --- START: NEW ENDPOINT FOR LISTING RECORDINGS ---
  server.get("/list-recordings", async (req, res) => {
    const recordingsData = {};
    try {
      const channelFolders = await fs.promises.readdir(recordingsBasePath);
      for (const channelFolder of channelFolders) {
        const channelPath = path.join(recordingsBasePath, channelFolder);
        const stats = await fs.promises.stat(channelPath);
        if (stats.isDirectory()) {
          const files = await fs.promises.readdir(channelPath);
          const videoFiles = files
            .filter((file) => file.endsWith(".mp4"))
            .map((file) => ({
              name: file,
              fullPath: path.join(channelPath, file),
            }));

          if (videoFiles.length > 0) {
            recordingsData[channelFolder] = videoFiles;
          }
        }
      }
      res.json(recordingsData);
    } catch (error) {
      console.error("[RECORDER] Error listing recordings:", error);
      res.status(500).json({ error: "Could not list recordings." });
    }
  });
  // --- END: NEW ENDPOINT ---

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

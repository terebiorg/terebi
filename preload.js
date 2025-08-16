const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopIntegration", {
  ipc: {
    // Send a message to the main process (fire-and-forget)
    send: (channel, data) => {
      ipcRenderer.send(channel, data);
    },
    // Listen for a message from the main process
    // The new function signature is safer as it avoids exposing the 'event' object
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    // ADDED: Send a message and wait for a reply
    invoke: (channel, ...args) => {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
});

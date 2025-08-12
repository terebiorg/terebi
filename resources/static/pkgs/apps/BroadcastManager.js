import Html from "/libs/html.js";
import Keyboard from "/libs/keyboard.js";
import vfs from "/libs/vfs.js";

import { ParseM3U } from "../../libs/iptv-parser.min.js";

let wrapper, Ui, Pid, Sfx;

const pkg = {
  name: "Broadcast Manager",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;

    wrapper = new Html("div").class("ui", "pad-top", "gap").appendTo("body");

    Ui.transition("popIn", wrapper);

    Ui.becomeTopUi(Pid, wrapper);

    Sfx = Root.Processes.getService("SfxLib").data;

    Sfx.playSfx("deck_ui_into_game_detail.wav");

    const Background = Root.Processes.getService("Background").data;

    console.log(Sfx);

    await vfs.importFS();

    async function promptForInput(
      title,
      description,
      parent,
      isPassword = false,
      resultName,
      prepend = "",
    ) {
      let options = {
        title,
        description,
        parent: document.body,
        pid: Root.Pid,
        value: parent.dataset.realText || "",
        type: isPassword === true ? "password" : "text",
      };

      let result = await Root.Libs.Modal.showKeyboard(options);

      if (result.canceled === true) return;

      parent.dataset.realText = result.value;
      if (isPassword === true) {
        parent.textContent = "•".repeat(result.value.length);
      } else parent.textContent = prepend + result.value;
      responseData[resultName] = prepend + result.value;

      return result.value;
    }

    let responseData = {
      cancelled: true,
      broadcastLink: null,
      broadcastIsFile: true,
      broadcastName: null,
      broadcastCover: "/assets/img/broadcast_cover.svg",
      broadcastPoster: "/assets/img/broadcast_poster.svg",
    };

    async function closeSequence() {
      let result = await Root.Libs.Modal.Show({
        parent: wrapper,
        pid: Root.Pid,
        title: "Are you sure you want to exit?",
        description: "Your progress will be lost.",
        buttons: [
          {
            type: "primary",
            text: "No",
          },
          {
            type: "negative",
            text: "Yes",
          },
        ],
      });
      console.log("HERE", result, responseData, launchArgs);
      if (result.id == 1) {
        if (launchArgs.callback) {
          launchArgs.callback();
        }
        pkg.end();
      }
    }

    let UiElems = [];
    let launchArgs = Root.Arguments !== undefined ? Root.Arguments[0] : {};

    new Html("h1").text("Add a broadcast").appendTo(wrapper);
    new Html("p")
      .text("Add a live broadcast file (.m3u8) to your library.")
      .appendTo(wrapper);

    new Html("h2").text("Broadcast name").appendTo(wrapper);

    const row = new Html("div").class("flex-list").appendTo(wrapper);

    new Html("button")
      .class("input-box")
      .html("<label>Enter your broadcast's name</label>")
      .on("click", async (e) => {
        await promptForInput(
          "Broadcast Name",
          "Enter your broadcast's name",
          e.target,
          false,
          "broadcastName",
        );
        if (e.target.textContent.trim() === "") {
          e.target.innerHTML = "<label>Enter your broadcast's name</label>";
          responseData["broadcastName"] = null;
        }
      })
      .appendTo(row);

    let selectedFile = null;

    new Html("h2").text("Broadcast file").appendTo(wrapper);
    let broadcastLocation = new Html("p")
      .text("No file or URL selected")
      .appendTo(wrapper);

    async function attemptParseM3U(data, url) {
      try {
        let results = await ParseM3U(data);

        if (!results.items) throw new Error();

        // if successful, set broadcastLink to the URL
        responseData["broadcastLink"] = url;

        channelList.clear();
        channelList.append(new Html("h3").text("Channels in this broadcast"));
        results.items.forEach((r) => {
          channelList.append(new Html("li").text(r.name));
        });
      } catch (_) {
        alert("Could not parse M3U data from file");
      }
    }

    let channelList = new Html("ul").appendTo(wrapper);

    const row3 = new Html("div")
      .class("flex-list")
      .appendMany(
        new Html("button").text("Import from file").on("click", async (e) => {
          Ui.transition("popOut", wrapper, 500, true);
          await Root.Libs.startPkg(
            "apps:FileManager",
            [
              {
                title: "Choose where the broadcast file is stored",
                fileSelect: true,
                callback: async function (arg) {
                  if (!arg.cancelled) {
                    console.log(arg);
                    selectedFile = arg.selected;
                    broadcastLocation.text(`Location: ${arg.selected}`);

                    const result = await fetch(
                      "http://127.0.0.1:9864/getFile?path=" +
                        encodeURIComponent(arg.selected),
                    ).catch((_) => undefined);

                    if (!result.ok) {
                      return alert("result not ok :(");
                    }
                    if (result === undefined) {
                      return alert("file fetch issue :(");
                    }

                    responseData.broadcastIsFile = true;
                    await attemptParseM3U(await result.text(), arg.selected);
                  }
                },
              },
            ],
            true,
          );
        }),
        new Html("button").text("Import by URL").on("click", async (e) => {
          await promptForInput(
            "Enter a URL",
            "URL for your broadcast",
            broadcastLocation.elm,
            false,
            "broadcastLink",
          );
          let givenUrl = responseData["broadcastLink"];
          console.log(givenUrl);
          // responseData["broadcastLink"] = null;
          // if (
          //   !givenUrl.startsWith("https://") ||
          //   !givenUrl.startsWith("http://")
          // ) {
          //   console.log("HOW THE FUCK");
          //   broadcastLocation.text("No file or URL selected");
          //   responseData["broadcastLink"] = null;
          //   return await Root.Libs.Modal.Show({
          //     parent: wrapper,
          //     pid: Root.Pid,
          //     title: "Invalid URL",
          //     description: "The URL you entered was invalid.",
          //     buttons: [
          //       {
          //         type: "primary",
          //         text: "OK",
          //       },
          //     ],
          //   });
          // }

          const result = await fetch(givenUrl).catch((_) => undefined);

          if (!result.ok) {
            return alert("Server response for file was not OK.");
          }
          if (result === undefined) {
            return alert("Unknown download error occurred.");
          }

          responseData.broadcastIsFile = false;
          selectedFile = givenUrl;
          await attemptParseM3U(await result.text(), givenUrl);
        }),
        new Html("button").text("Add broadcast").on("click", async (e) => {
          if (selectedFile == null) {
            await Root.Libs.Modal.Show({
              parent: wrapper,
              pid: Root.Pid,
              title: "Please select a file or enter a link.",
              description:
                "Please select where Movies & TV will receive the broadcast.",
              buttons: [
                {
                  type: "primary",
                  text: "OK",
                },
              ],
            });
            return;
          }
          if (responseData.broadcastName == null) {
            responseData.broadcastName = responseData["broadcastName"];
            if (responseData.broadcastName == null) {
              await Root.Libs.Modal.Show({
                parent: wrapper,
                pid: Root.Pid,
                title: "Please choose a name for the broadcast",
                description: "This will be the name of the collection.",
                buttons: [
                  {
                    type: "primary",
                    text: "OK",
                  },
                ],
              });
            }
            return;
          }

          responseData.broadcastLink = selectedFile;
          responseData.cancelled = false;

          if (launchArgs.callback) {
            launchArgs.callback(responseData);
          }
          pkg.end();
        }),
      )
      .appendTo(wrapper);

    UiElems = [row.elm.children, row3.elm.children];

    Ui.init(Pid, "horizontal", UiElems, function (e) {
      if (e === "back") {
        closeSequence();
      }
    });
  },
  end: async function () {
    // Exit this UI when the process is exited
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    // await Ui.transition("popOut", wrapper);
    Ui.giveUpUi(Pid);
    wrapper.cleanup();
  },
};

export default pkg;

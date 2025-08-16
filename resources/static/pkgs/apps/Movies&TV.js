import Html from "/libs/html.js";
import Ws from "/libs/windowSystem.js";
import Keyboard from "/libs/keyboard.js";
import vfs from "/libs/vfs.js";

let wrapper, Ui, Pid, Sfx;

const pkg = {
  name: "Movies & TV",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;

    wrapper = new Html("div").class("ui", "pad-top-sm", "gap").appendTo("body");

    window.desktopIntegration !== undefined &&
      window.desktopIntegration.ipc.send("setRPC", {
        details: "Searching for movies and shows",
      });

    Ui.transition("popIn", wrapper);

    Ui.becomeTopUi(Root.Pid, wrapper);

    Sfx = Root.Processes.getService("SfxLib").data;
    const watchListTemplate = {
      movies: [],
      shows: [],
      broadcasts: [],
    };
    let watchList = watchListTemplate;

    await vfs.importFS();

    let dataPath = "Root/CherryTree/user/WatchLibrary.json";

    if (await vfs.exists(dataPath)) {
      watchList = Object.assign(
        watchListTemplate,
        JSON.parse(await vfs.readFile(dataPath)),
      );
    } else {
      await vfs.writeFile(dataPath, JSON.stringify(watchList));
    }

    console.log(watchList);

    new Html("h1").text("Movies & TV").appendTo(wrapper);
    new Html("p")
      .text("Watch movies and shows stored on this TV")
      .appendTo(wrapper);

    // const row = new Html("div").class("flex-list").appendTo(wrapper);

    new Html("h2").text("Movies").appendTo(wrapper);
    const movieRow = new Html("div").class("flex-list").appendTo(wrapper);
    let noMovies = new Html("button")
      .text("No movies have been added")
      .appendTo(movieRow);

    new Html("h2").text("Shows").appendTo(wrapper);
    const showRow = new Html("div").class("flex-list").appendTo(wrapper);
    let noShows = new Html("button")
      .text("No shows have been added")
      .appendTo(showRow);

    new Html("h2").text("Broadcasts").appendTo(wrapper);
    const broadcastRow = new Html("div").class("flex-list").appendTo(wrapper);
    let noBroadcasts = new Html("button")
      .text("No broadcasts have been added")
      .appendTo(broadcastRow);

    new Html("h2").text("Add...").appendTo(wrapper);
    const actionRow = new Html("div").class("flex-list").appendTo(wrapper);

    // Function to update the movies list
    async function updateMovieList() {
      movieRow.clear();

      if (watchList.movies.length === 0) {
        noMovies = new Html("button")
          .text("No movies have been added")
          .appendTo(movieRow);
      } else {
        watchList.movies.forEach((movie, index) => {
          createMovieButton(movie, index).appendTo(movieRow);
        });
      }

      Ui.init(
        Root.Pid,
        "horizontal",
        [
          movieRow.elm.children,
          showRow.elm.children,
          broadcastRow.elm.children,
          actionRow.elm.children,
        ],
        function (e) {
          if (e === "back") {
            Root.end();
          }
        },
      );
    }

    // Function to update the shows list
    async function updateShowList() {
      showRow.clear();

      if (watchList.shows.length === 0) {
        noShows = new Html("button")
          .text("No shows have been added")
          .appendTo(showRow);
      } else {
        watchList.shows.forEach((show, index) => {
          createShowButton(show, index).appendTo(showRow);
        });
      }

      Ui.init(
        Root.Pid,
        "horizontal",
        [
          movieRow.elm.children,
          showRow.elm.children,
          broadcastRow.elm.children,
          actionRow.elm.children,
        ],
        function (e) {
          if (e === "back") {
            Root.end();
          }
        },
      );
    }

    function updateBroadcastList() {
      broadcastRow.clear();

      if (watchList.broadcasts.length === 0) {
        noBroadcasts = new Html("button")
          .text("No broadcasts have been added")
          .appendTo(broadcastRow);
      } else {
        watchList.broadcasts.forEach((broadcast, index) => {
          createBroadcastButton(broadcast, index).appendTo(broadcastRow);
        });
      }

      Ui.init(
        Root.Pid,
        "horizontal",
        [
          movieRow.elm.children,
          showRow.elm.children,
          broadcastRow.elm.children,
          actionRow.elm.children,
        ],
        function (e) {
          if (e === "back") {
            Root.end();
          }
        },
      );
    }
    function createMovieButton(movie, index) {
      let button = new Html("button");
      let img = new Html("img");
      let title = new Html("p");

      title.text(movie.movieName);
      img.attr({ src: movie.moviePoster });

      button
        .styleJs({
          display: "flex",
          flexDirection: "column",
          width: "40px",
          height: "100%",
          gap: "10px",
        })
        .on("click", async (e) => {
          document.dispatchEvent(
            new CustomEvent("CherryTree.Ui.ChangePreview", {
              detail: {
                title: `${movie.movieName}`,
                description: `Hop on to Movies and TV and rewatch ${movie.movieName}.`,
                image: movie.movieCover,
              },
            }),
          );
          Ui.transition("popOut", wrapper, 500, true);
          await Root.Libs.startPkg(
            "apps:MovieViewer",
            [
              movie,
              {
                callback: async function (remove) {
                  if (remove) {
                    watchList.movies.splice(index, 1);
                    await vfs.writeFile(dataPath, JSON.stringify(watchList));
                    button.cleanup();
                    updateMovieList();
                  }
                },
              },
            ],
            true,
          );
        });

      title.styleJs({ textAlign: "center", width: "100%" });
      img.styleJs({ width: "100%" });

      img.appendTo(button);
      title.appendTo(button);
      return button;
    }

    function createShowButton(show, index) {
      let button = new Html("button");
      let img = new Html("img");
      let title = new Html("p");

      title.text(show.showName);
      img.attr({ src: show.showPoster });

      button
        .styleJs({
          display: "flex",
          flexDirection: "column",
          width: "40px",
          height: "100%",
          gap: "10px",
        })
        .on("click", async (e) => {
          document.dispatchEvent(
            new CustomEvent("CherryTree.Ui.ChangePreview", {
              detail: {
                title: `${show.showName}`,
                description: `Hop on to Movies and TV and continue watching ${show.showName}.`,
                image: show.showCover,
              },
            }),
          );
          Ui.transition("popOut", wrapper, 500, true);
          await Root.Libs.startPkg(
            "apps:ShowViewer",
            [
              show,
              {
                callback: async function (remove) {
                  if (remove) {
                    watchList.shows.splice(index, 1);
                    await vfs.writeFile(dataPath, JSON.stringify(watchList));
                    button.cleanup();
                    updateShowList();
                  }
                },
              },
            ],
            true,
          );
        });

      title.styleJs({ textAlign: "center", width: "100%" });
      img.styleJs({ width: "100%" });

      img.appendTo(button);
      title.appendTo(button);
      return button;
    }

    function createBroadcastButton(broadcast, index) {
      let button = new Html("button");
      let img = new Html("img");
      let title = new Html("p");

      title.text(broadcast.broadcastName);
      img.attr({ src: broadcast.broadcastPoster });

      button
        .styleJs({
          display: "flex",
          flexDirection: "column",
          width: "40px",
          height: "100%",
          gap: "10px",
        })
        .on("click", async (e) => {
          Ui.transition("popOut", wrapper, 500, true);
          await Root.Libs.startPkg(
            "apps:BroadcastViewer",
            [
              broadcast,
              {
                callback: async function (remove) {
                  if (remove) {
                    watchList.broadcasts.splice(index, 1);
                    await vfs.writeFile(dataPath, JSON.stringify(watchList));
                    button.cleanup();
                    updateBroadcastList();
                  }
                },
              },
            ],
            true,
          );
        });

      title.styleJs({ textAlign: "center", width: "100%" });
      img.styleJs({ width: "100%" });

      img.appendTo(button);
      title.appendTo(button);
      return button;
    }

    async function movieCreated(data) {
      if (data.cancelled) {
        return;
      }
      console.log(data);
      watchList.movies.push(data);
      await vfs.writeFile(dataPath, JSON.stringify(watchList));
      updateMovieList();

      setTimeout(async () => {
        await Root.Libs.Modal.Show({
          parent: wrapper,
          pid: Root.Pid,
          title: "Movie added",
          description: `${data.movieName} has been added to your library.`,
          buttons: [
            {
              type: "primary",
              text: "OK",
            },
          ],
        });
      }, 500);
    }

    async function showCreated(data) {
      if (data.cancelled) {
        return;
      }
      console.log(data);
      watchList.shows.push(data);
      await vfs.writeFile(dataPath, JSON.stringify(watchList));
      updateShowList();

      setTimeout(async () => {
        await Root.Libs.Modal.Show({
          parent: wrapper,
          pid: Root.Pid,
          title: "Show added",
          description: `${data.showName} has been added to your library.`,
          buttons: [
            {
              type: "primary",
              text: "OK",
            },
          ],
        });
      }, 500);
    }

    async function broadcastCreated(data) {
      if (data.cancelled) {
        return;
      }
      console.log(data);
      watchList.broadcasts.push(data);
      await vfs.writeFile(dataPath, JSON.stringify(watchList));
      updateBroadcastList();

      setTimeout(async () => {
        await Root.Libs.Modal.Show({
          parent: wrapper,
          pid: Root.Pid,
          title: "Broadcast added",
          description: `${data.broadcastName} has been added to your library.`,
          buttons: [
            {
              type: "primary",
              text: "OK",
            },
          ],
        });
      }, 500);
    }

    updateMovieList();
    updateShowList();
    updateBroadcastList();

    actionRow.appendMany(
      new Html("button").text("Add movies").on("click", async (e) => {
        Ui.transition("popOut", wrapper, 500, true);
        await Root.Libs.startPkg(
          "apps:MoviesManager",
          [{ callback: movieCreated }],
          true,
        );
      }),
      new Html("button").text("Add shows").on("click", async (e) => {
        Ui.transition("popOut", wrapper, 500, true);
        await Root.Libs.startPkg(
          "apps:ShowsManager",
          [{ callback: showCreated }],
          true,
        );
      }),
      new Html("button").text("Add broadcast").on("click", async (e) => {
        Ui.transition("popOut", wrapper, 500, true);
        await Root.Libs.startPkg(
          "apps:BroadcastManager",
          [{ callback: broadcastCreated }],
          true,
        );
      }),
      new Html("button").text("View recordings").on("click", async (e) => {
        Ui.transition("popOut", wrapper, 500, true);
        await Root.Libs.startPkg("apps:RecordingsViewer", [], true);
      }),
    );

    Ui.init(
      Root.Pid,
      "horizontal",
      [
        movieRow.elm.children,
        showRow.elm.children,
        broadcastRow.elm.children,
        actionRow.elm.children,
      ],
      function (e) {
        if (e === "back") {
          Root.end();
        }
      },
    );
  },
  end: async function () {
    document.dispatchEvent(new CustomEvent("CherryTree.Ui.ExitApp"));
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    Ui.giveUpUi(Pid);
    wrapper.cleanup();
  },
};

export default pkg;

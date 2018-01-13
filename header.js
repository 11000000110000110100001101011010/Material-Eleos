// @flow
/*jshint esversion: 6 */
/*jslint node: true */
"use strict";

const {ipcRenderer} = require("electron");


function generateQuery(method, params) {
    let jsonObject;
    jsonObject = {"jsonrpc": "1.0", "id": method, "method": method, "params": params};
    ipcRenderer.send("jsonQuery-request", jsonObject);
    return (jsonObject);
}


ipcRenderer.on("jsonQuery-reply", (event, arg) => {
    if (arg.error && arg.error.code === -28) {
        document.getElementById("alertSpan").innerHTML = '<a style="text-align: center;">' + arg.error.message + '</a>';
    }
    else {
        document.getElementById("alertSpan").innerHTML = "";
    }

    if (arg.id === "getnetworkinfo" && arg.result) {
        document.getElementById("connectionsValue").innerHTML = arg.result.connections;
    }
    else if (arg.id === "getblockchaininfo" && arg.result) {
        let status = ((arg.result.blocks / arg.result.headers) * 100).toFixed(1);
        document.getElementById("syncStatusValue").innerHTML = status;

        if (status < 100) {
            document.getElementById("syncStatusLabel").style.backgroundColor = "orange";
        }
        else {
            document.getElementById("syncStatusLabel").style.backgroundColor = "";
        }
    }
    else if (arg.id === "z_gettotalbalance" && arg.result) {
        document.getElementById("currentBalanceValue").innerHTML = arg.result.total;
        document.getElementById("transparentAvailableValue").innerHTML = arg.result.transparent;
        document.getElementById("privateBalanceValue").innerHTML = arg.result.private;
    }
});

ipcRenderer.on("coin-reply", (event, arg) => {
    let elements = document.getElementsByClassName("coin");
    for (let i = 0; i < elements.length; i++) {
        elements[i].innerHTML = arg;
    }
});

ipcRenderer.on("params-pending", (event, arg) => {
    if (arg.percent < 1) {
        document.getElementById("alertSpan").innerHTML = '' +
            '<a style="text-align: center;">downloading keys</a>' +
            '<a style="text-align: center;">' + (arg.name.substr(arg.name.lastIndexOf('/') + 1)) + '</a>' +
            '<a style="text-align: center;">' + (arg.percent * 100).toFixed(2) + '%</a>';
    }
    else if (!arg.percent || arg.percent === 1) {
        document.getElementById("alertSpan").innerHTML = "";
    }
});

ipcRenderer.on("params-complete", (event, arg) => {
    if (arg === false) {
        document.getElementById("alertSpan").innerHTML = '' +
            '<a style="text-align: center;">initializing</a>';
    }
    else {
        document.getElementById("alertSpan").innerHTML = "";
    }
});

function refreshUI() {
    ipcRenderer.send("coin-request");
    ipcRenderer.send("check-params");
    ipcRenderer.send("check-config");
    ipcRenderer.send("check-wallet");
    generateQuery("getblockchaininfo", []);

    // for general use
    generateQuery("getnetworkinfo", []);
    generateQuery("getinfo", []);
    generateQuery("z_gettotalbalance", [0]);

}

refreshUI();
setInterval(refreshUI, 900);

module.exports = {
    generateQuerySync: function (method, params) {
        return generateQuerySync(method, params);
    },
    generateQuery: function (method, params) {
        return generateQuery(method, params);
    },
    showTxDetails: function (txid) {
        return showTxDetails(txid);
    },
    saveOpts: function (opts) {
        ipcRenderer.send("save-opts", opts);
    }
};








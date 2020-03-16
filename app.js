const { app, BrowserWindow, ipcMain, net } = require('electron')
const fs = require('fs')
const SockJS = require('sockjs-client');
//const Stomp = require('stompjs');
const WebSocket = require('ws');

var win,
    settings,
    user,
    socket,
    stompClient

init();

function init(){
  fs.readFile("./settings.json",'utf8', (err, data) => {
    if (err) throw err;
    settings = JSON.parse(data)
  });
  app.allowRendererProcessReuse = true;
  app.whenReady().then(createMainWindow)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

function createMainWindow () {
   win = new BrowserWindow({
    width: 700,
    height: 800,
    frame: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  if(user){
    win.loadFile('rendered/main.html')
  }else{
    win.loadFile('rendered/login.html')
  }
  win.webContents.openDevTools()
  win.on('closed', () =>{
    win = null;
  })
}

ipcMain.on("login-channel", (e, credential) =>{
  login(e, credential)
})

function login(e, credential){
  var postData = JSON.stringify(credential);
  request(`${settings.url}/authorize`, postData, "POST", {"content-type":"application/json"}, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      e.sender.send('error-channel', data.message)
    }else{
      user=data.body
      user.password = credential.password
      win.loadFile('rendered/main.html')
    }
  }, (code, data)=>{
    e.sender.send('error-channel', `Error: ${code}. Connection refused!`)
  })
}

ipcMain.on("load-main-channel", (e) =>{
  console.log(user)
  socket = new SockJS(settings.url+"/websocket")
  // stompClient = Stomp.over(socket);
  // //stompClient = Stomp.overWS('http://localhost:8080/communicator/websocket');
  // stompClient.connect({}, function (frame) {
  //   console.log("connect")
  //     stompClient.subscribe('/message/receiv/' + user.id, function (message) {
  //       let body = JSON.parse(message.body);
  //       processMessage(body)
  //   });
  // }, function (error){
  //   console.log(error)
  // })
  const ws = new WebSocket(socket);

  ws.on('open', function open() {
    ws.send('something');
  });

  ws.on('message', function incoming(data) {
    console.log(data);
  });
  console.log("connected")
  request(`${settings.url}/contacts`, null, "GET", null, (chunk)=>{
    let data = JSON.parse(chunk)
    if(data.code!=200){
      e.sender.send('error-channel', data.message)
    }else{
      e.sender.send('users-channel', data.body)
    }
  }, (code, data)=>{
    e.sender.send('error-channel', `Error: ${code}. Connection refused!`)
  })
  request(`${settings.url}/conferences`, null, "GET", null, (chunk)=>{
    let data = JSON.parse(chunk)
    if(data.code!=200){
      e.sender.send('error-channel', data.message)
    }else{
      e.sender.send('conferences-channel', data.body)
    }
  }, (code, data)=>{
    e.sender.send('error-channel', `Error: ${code}. Connection refused!`)
  })
})

ipcMain.on("send-message-channel", (e, data) =>{
  console.log(e.sender.uuid)
  console.log(data)
  stompClient.send("/app/message/send", {}, JSON.stringify({'content': data.message, 'writeTime': new Date().getTime(), 'idUser': user.id, 'uuidConversation': e.sender.uuid}));
})

function processMessage(message){
  console.log(message)
}

ipcMain.on("create-conversation-channel", (e, data) =>{
  var postData = JSON.stringify(data);
  request(`${settings.url}/conferences/add`, postData, "POST", {"content-type":"application/json"}, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      e.sender.send('error-channel', data.message)
    }else{
      openConversation(data.body)
    }
    }, (code, response)=>{
      e.sender.send('error-channel', `Error: ${code}. Connection refused!`)
    })
})

function openConversation(conversation){
  console.log(conversation)
  let found = false;
  BrowserWindow.getAllWindows().forEach(w=>{
    if(w.webContents.uuid==conversation.uuid){
      found=true;
      w.show()
    }
  })
  if(!found){
    console.log("create conversation")
    conversationWindow = new BrowserWindow({
     width: 700,
     height: 800,
     title: conversation.name,
     resizable: false,
     webPreferences: {
       nodeIntegration: true
     }
   })
   conversationWindow.once('ready-to-show', () => {
     console.log("ASDASD")
     conversationWindow.webContents.send('conversation-init-channel', conversation);
   })
   conversationWindow.webContents.uuid = conversation.uuid
   conversationWindow.loadFile('rendered/conversation.html')
   conversationWindow.webContents.openDevTools()
  }
}

function request(url, postData, method, headers, success, error){
  const request = net.request({"url": url, method: method})
  request.on('login', (authInfo, callback) => {
    if(user){
      callback(user.nick, user.password)
    }else{
      win.loadFile('rendered/login.html')
    }
  })
  if(headers!=null){
    for (let [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }
  }
  request.on('response', (response) => {
    if(response.statusCode==200){
      response.on('data', (chunk) => {
        success(chunk)
      })
    }else{
      var body = '';
      response.on('data', function (chunk) {
        body += chunk;
      });
      response.on('end', function () {
        error(response.statusCode, body)
      });
    }
  })
  if(postData){
    request.end(postData)
  }else{
      request.end()
  }
}

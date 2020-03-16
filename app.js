const { app, BrowserWindow, ipcMain, net } = require('electron')
const fs = require('fs')
var Stomp = require('stompjs')
var SockJS = require('sockjs-client')

var win,
    settings,
    user,
    sock,
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
    if(stompClient){
      stompClient.disconnect();
    }
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
      win.sender.send('error-channel', data.message)
    }else{
      user=data.body
      user.password = credential.password
      win.loadFile('rendered/main.html')
    }
  }, (code, data)=>{
    win.sender.send('error-channel', `Error: ${code}. Connection refused!`)
  })
}

ipcMain.on("load-main-channel", (e) =>{
  sock= new SockJS(`${settings.url}/websocket`);
  stompClient = Stomp.over(sock);
  stompClient.connect({}, function (frame) {
      console.log('Connected: ' + frame);
      stompClient.subscribe(`/message/receiv/${user.id}`, processMessage);
  },(error)=>{console.log(error);});

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

ipcMain.on("init-conversation-channel", (e, data) =>{
  let callback = function(messages){
    e.sender.send("init-conversation-response-channel", JSON.stringify({"idUser": user.id, "messages": messages}))
  }
  getMessages(e.sender.uuid, 0, callback)
})

ipcMain.on("send-message-channel", (e, data) =>{
  try{
    stompClient.send("/app/message/send", {}, JSON.stringify({'content': data.message, 'writeTime': new Date().getTime(), 'idUser': user.id, 'uuidConversation': e.sender.uuid}));
  }catch(e){
    console.log(e)
  }
})

var processMessage = function(messageResponse){
  let message = JSON.parse(messageResponse.body);
  let sendMessageToConversationView = (window)=>{
    window.webContents.send("message-comming-channel", message)
  }
  openConversation(message.uuidConversation, sendMessageToConversationView)
};

function getMessages(uuid, offset, callback){
  request(`${settings.url}/messages/get/${uuid}/${offset}`, null, "GET", null, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      console.log(data)
      win.webContents.send('error-channel', data.message)
    }else{
      callback(data.body)
    }
    }, (code, response)=>{
      win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
    })
}

ipcMain.on("create-conversation-channel", (e, data) =>{
  createConversationRequestByUserNicks(data)
})

function createConversationRequestByUserNicks(data){
  var postData = JSON.stringify(data);
  request(`${settings.url}/conferences/add`, postData, "POST", {"content-type":"application/json"}, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      win.webContents.send('error-channel', data.message)
    }else{
      openConversation(data.body.uuid)
    }
    }, (code, response)=>{
      win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
    })
}

function openConversation(uuid, callbackAfterOpen){
  let found = findConversationWindow(uuid)
  if(found==null){
    let callback = (response)=>{
      let data = JSON.parse(response)
      if(data.code!=200){
        win.webContents.send('error-channel', data.message)
      }else{
        let conversation = data.body
        conversationWindow = new BrowserWindow({
         width: 700,
         height: 800,
         title: conversation.name,
         resizable: false,
         webPreferences: {
           nodeIntegration: true
         }
       })
       conversationWindow.webContents.uuid = uuid
       conversationWindow.loadFile('rendered/conversation.html')
       conversationWindow.webContents.openDevTools()
       if(callbackAfterOpen)
        callbackAfterOpen(conversationWindow)
      }
    }
    getConversationRequest(uuid, callback)
 }else{
   found.show();
   callbackAfterOpen(found)
 }
}

function getConversationRequest(uuid, callback){
  let conversation
  request(`${settings.url}/conversations/get/${uuid}`, null, "GET", null, callback, (code, response)=>{
    win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
  })
  return conversation;
}

function findConversationWindow(uuid){
  let result = null
  BrowserWindow.getAllWindows().forEach(w=>{
    if(w.webContents.uuid==uuid){
      result = w;
    }
  })
  return result;
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

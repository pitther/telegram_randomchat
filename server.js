const TeleBot = require('telebot');
let token = "";
let bot = new TeleBot(token);

let lang_list = ["/ENG","/UA","/RU","/BLR","/SO","/SI","/HU"];

class Core{
    constructor(){
        this.users = new Map();
        this.keyboards = {
            //main_menu : bot.keyboard([["/random"],["/choose_lang"]], {resize: true}),
            main_menu : bot.keyboard([["/random"]], {resize: true}),
            queue : bot.keyboard([["/leave_queue"]], {resize: true}),
            choose_language : bot.keyboard(listToFixed(lang_list,3), {resize: true}),
            chat : bot.keyboard([["/leave_chat"]], {resize: true})
        }
        this.queue = new Map();
        this.chats = new Map();
    }
    closeChat(id){
        console.log(id, "Chat closed!");
        if ( this.chats.has(id) ){
            this.chats.delete(id);
        }
    }
    handle_message(msg){
        if ( !this.users.has(msg.id) ){
            this.users.set(msg.id, new User(msg.id));
        }
        if (msg.text[0] != '/'){
            if ( this.users.get(msg.chat.id).inRoom() ){
                this.chats.get( this.users.get(msg.chat.id).chat_id ).mMsg(msg);
            }
        }
        return {text:"",markup:""}
    }
    addToQueue(id){
        console.log(id, "added to queue");
        if ( !this.users.has(id) ){
            this.users.set(id, new User(id));
        }
        if ( !this.queue.has(id) ){
            this.users.get(id).searching();
            this.queue.set( id, this.users.get(id) );
        }
        this.updateQueuePooling();
    }
    removeFromQueue(id){
        if ( this.queue.has(id) ){
            this.queue.delete(id);
            return "Left from queue."
        } else {
            return "You're not in queue."
        }
    }
    createChat(uid1,uid2){
        let cid = uid1 + '' + uid2;
        console.log(cid, "Chat created!");
        this.chats.set(cid, new Chat(cid, this.users.get(uid1),  this.users.get(uid2) ) );
        this.chats.get(cid).onStart();
    }
    updateQueuePooling(){
        let q_ = this.queue;
        q_.forEach(function(val1,key1,map1){
            q_.forEach(function(val2,key2,map2){
                if (key1 != key2 && val1.isFree() && val2.isFree() ){
                    val1.active();
                    val2.active();
                    this.removeFromQueue(key1);
                    this.removeFromQueue(key2);
                    this.createChat(key1,key2);
                }
            }.bind(this));
        }.bind(this));

    }

}

class Chat{
    constructor(id,user1,user2){
        this.id = id;
        this.user1 = user1;
        this.user2 = user2;
        console.log(user1);
        console.log(user2);
    }
    close(){
        this.user1.onClose();
        this.user2.onClose();
        core.closeChat(this.id);
    }
    mMsg(msg){
        if ( this.user1.id == msg.chat.id ){
            bot.sendMessage(this.user2.id, "HE: " + msg.text);
        } else {
            bot.sendMessage(this.user1.id, "HE: " + msg.text);
        }
    }
    onStart(){
        this.user1.onStartChat(this.id);
        this.user2.onStartChat(this.id);
        let replyMarkup = core.keyboards.chat;
        bot.sendMessage(this.user1.id, "The chat with anon has started... \n", {replyMarkup});
        bot.sendMessage(this.user2.id, "The chat with anon has started... \n", {replyMarkup});
    }
}

class User{
    constructor(id){
        this.id = id;
        this.flags = new Map();
        this.idle();
        this.chat_id = 0;
    }
    onStartChat(chatid){
        this.chat_id = chatid;
    }
    isFree(){
        if (this.state == "searching"){
            return true;
        } else {
            return false;
        }
    }
    inRoom(){
        if ( this.chat_id != 0 ){
            return true;
        } else {
            return false;
        }
    }
    onClose(){
        this.idle();
        this.idle();
        this.chat_id = 0;
        let replyMarkup = core.keyboards.main_menu;
        bot.sendMessage(this.id, "The chat has ended. \nType /random to find new chat-user", {replyMarkup});
    }
    active(){
        this.state = "active";
    }
    searching(){
        this.state = "searching";
    }
    idle(){
        this.state = "idle";
    }
    setLang(s_){
        this.flags.set("lang", s_);
    }
}

let core = new Core();


bot.on('text', (msg) => {
    if ( !core.users.has(msg.chat.id) ){
        core.users.set(msg.chat.id, new User(msg.chat.id));
    }
    let reply = core.handle_message(msg);
    let replyMarkup = reply.markup,
        parseMode = "Markdown";
    if (reply.text != ""){
        let replyMarkup = core.keyboards.main_menu;
        bot.sendMessage(msg.chat.id, "Hello, "+msg.from.first_name+". Type /random to find random chat-user. ", {replyMarkup});
        if (replyMarkup)
            bot.sendMessage(msg.chat.id, reply.text, {parseMode,replyMarkup});
        else
            bot.sendMessage(msg.chat.id, reply.text, {parseMode});
    }
});

bot.on(['/start'], (msg) => {
  let replyMarkup = core.keyboards.main_menu;
  bot.sendMessage(msg.chat.id, "Hello, "+msg.from.first_name+". Type /random to find random chat-user. ", {replyMarkup});
});

bot.on(['/menu'], (msg) => {
    let replyMarkup = core.keyboards.main_menu;
    bot.sendMessage(msg.chat.id, "Menu. ", {replyMarkup});
});

bot.on(['/random'], (msg) => {
  let replyMarkup = core.keyboards.queue;
  bot.sendMessage(msg.chat.id, "Please wait.\nLooking for random user...", {replyMarkup});
  core.addToQueue(msg.chat.id);
});

bot.on(['/choose_lang'], (msg) => {

  let replyMarkup = core.keyboards.choose_language;
  bot.sendMessage(msg.chat.id, "Choose your language: ", {replyMarkup});
});

bot.on(['/leave_queue'], (msg) => {
    let r_ = core.removeFromQueue(msg.chat.id);
    let replyMarkup = core.keyboards.main_menu;
    bot.sendMessage(msg.chat.id, r_+"\nType /random to find random chat-user. ", {replyMarkup});

});

bot.on(['/leave_chat'], (msg) => {
    let replyMarkup = core.keyboards.main_menu;
    //bot.sendMessage(msg.chat.id, "Left from chat. \nType /random to find another random chat-user. ", {replyMarkup});
    if ( core.users.has(msg.chat.id) ){
        if ( core.users.get(msg.chat.id).inRoom() ){
            core.chats.get(core.users.get(msg.chat.id).chat_id).close();
        }
    }
});

bot.start();

function listToFixed(list, k){
  let result = [];
  while(list.length) result.push(list.splice(0,k));
  return result;
}

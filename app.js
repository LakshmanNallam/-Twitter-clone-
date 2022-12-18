const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
const middleware = async (request, response, next) => {
  const token = request.headers["authorization"];
  console.log(token);
  let tokennumbers;
  if (token !== undefined) {
    const array = token.split(" ");
    tokennumbers = array[1];
  }

  console.log(tokennumbers);
  if (tokennumbers === undefined) {
    response.status(401);
    response.send("Invalis JWT Token");
  } else {
    jwt.verify(tokennumbers, "mysecretkeydfgf", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        request.username = payload.username;
        next();
      }
    });
  }
};
//api 3
app.get("/user/tweets/feed/", middleware, async (request, response) => {
  const { username } = request;
  console.log(username);
  const query = `select t2.username,tweet,date_time as dateTime from( user inner join follower on user.user_id=follower.follower_user_id)as t1 inner join (follower inner join user  on follower.following_user_id=user.user_id inner join tweet on tweet.user_id=user.user_id) as t2 on t1.following_user_id=t2.following_user_id where t1.username='${username}' order by date_time desc limit 4;`;
  const data = await db.all(query);
  response.send(data);
});
//api 4
app.get("/user/following/", middleware, async (request, response) => {
  const { username } = request;
  const query = `select DISTINCT t2.username  from (user inner join follower on user.user_id=follower.follower_user_id) as t1 inner join (follower inner join user on user.user_id=follower.following_user_id) as t2 on t1.following_user_id=t2.following_user_id where t1.username like '${username}';`;
  const data = await db.all(query);
  response.send(data);
});
//api 5
app.get("/user/followers/", middleware, async (request, response) => {
  const { username } = request;
  const query = `select distinct t2.username from (user inner join follower on user.user_id=follower.following_user_id) as t1 inner join (follower inner join user on follower.follower_user_id=user.user_id) as t2 on t1.user_id=t2.following_user_id where t1.username='${username}';`;
  const data = await db.all(query);
  response.send(data);
});
//api 6
app.get("/tweets/:tweetId/", middleware, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const query = `select DISTINCT tweet,count(DISTINCT like_id) as likes,count(distinct reply_id) as replies,date_time as dateTime from (user inner join follower on user.user_id=follower.follower_user_id) as t1  inner join tweet on t1.following_user_id=tweet.user_id inner join 
reply on reply.tweet_id=tweet.tweet_id inner join like on like.tweet_id=tweet.tweet_id 
  where tweet.tweet_id=${tweetId} and t1.username='${username}';`;
  const data = await db.get(query);
  console.log(data);
  if (data.tweet === null) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(data);
  }
});
//api 7
app.get("/tweets/:tweetId/likes/", middleware, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const Query = `select t2.username from (user inner join follower on user.user_id=follower.follower_user_id inner join tweet on tweet.user_id=follower.following_user_id) as t1 inner join (tweet inner join like on tweet.tweet_id=like.tweet_id inner join user on like.user_id=user.user_id) as t2 on t1.tweet_id=t2.tweet_id where t1.username='${username}' and t1.tweet_id=${tweetId};`;
  const data = await db.all(Query);
  console.log(data.length);
  const likes = [];
  if (data.length === 0) {
    response.status(400);
    response.send("Invalid Request");
  } else {
    for (let items of data) {
      likes.push(items.username);
    }

    response.send({ likes });
  }
});
//api 8
app.get("/tweets/:tweetId/replies/", middleware, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const query = `select distinct t2.username,t2.reply from (user inner join follower on user.user_id=follower.follower_user_id inner join tweet on tweet.user_id=follower.following_user_id) as t1 inner join (tweet inner join reply on tweet.tweet_id=reply.tweet_id inner join user on user.user_id=reply.user_id) as t2 on t1.tweet_id=t2.tweet_id where 
  t1.username like '${username}' and t1.tweet_id=${tweetId};`;
  const data = await db.all(query);

  if (data.length === 0) {
    response.status(400);
    response.send("Invalid Request");
  } else {
    response.send(data);
  }
});

//api 9
app.get("/user/tweets/", middleware, async (request, response) => {
  const { username } = request;
  const query = `select t1.tweet as tweet,count(distinct like.like_id) as likes,count(distinct reply.reply_id) as replies , t1.date_time as dateTime from (user inner join tweet on user.user_id=tweet.user_id) as t1 inner join (tweet inner join like on like.tweet_id=tweet.tweet_id inner join reply on reply.tweet_id=tweet.tweet_id) as t2 on t1.tweet=t2.tweet 
  where username like "${username}" group by t1.tweet;`;
  const data = await db.all(query);
  response.send(data);
});

app.post("/user/tweets/", middleware, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const queryforid = `select user_id from user where username like '${username}';`;

  const userId = await db.get(queryforid);
  console.log(userId.user_id);
  const query = `insert into tweet (tweet,user_id,date_time) values('${tweet}',${
    userId.user_id
  },'${new Date()}')`;
  await db.run(query);
  response.send("Created a Tweet");
});
/*const querytodelate = `delete from tweet where tweet_id=${tweetId};`;
    await db.run(querytodelate);
    response.send("Tweet Removed");*/
app.delete("/tweets/:tweetId/", middleware, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const query = `select * from user inner join tweet on tweet.user_id=user.user_id where tweet_id=${tweetId} and username like '${username}';`;
  const data = await db.get(query);
  console.log(data);
  console.log(data);
  if (data === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const query = `delete from tweet where tweet_id=${tweetId};`;
    await db.run(query);
    response.send("Tweet Removed");
  }
});

//api2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(username, password);
  const sqlquery = `select * from user where username like '${username}';`;
  const data = await db.get(sqlquery);
  if (data !== undefined) {
    let booll = await bcrypt.compare(password, data.password);
    console.log(booll);
    if (booll) {
      const queryforid = `select user_id as id from user where username like '${username}';`;
      const user_id = await db.get(queryforid);
      console.log(user_id.id);
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "mysecretkeydfgf");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

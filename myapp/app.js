const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

dbPath = path.join(__dirname, "taskManagement.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server Running at http://localhost:3000/`);
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//API: Register New User
app.post("/register/", async (request, response) => {
  const { username, password_hash } = request.body;

  const userCheckQuery = `
    SELECT * FROM Users WHERE username = '${username}';`;
  const dbUser = await db.get(userCheckQuery);
  if (dbUser === undefined) {
    if (password_hash.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashPassword = await bcrypt.hash(password_hash, 10);
      const registerUserQuery = `
            INSERT INTO 
                Users(username, password_hash)
            VALUES
                ('${username}', '${hashPassword}');`;
      await db.run(registerUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.headers.username = payLoad.username;
        next();
      }
    });
  }
};

//API: Login User
app.post("/login/", async (request, response) => {
  const { username, password_hash } = request.body;
  const payLoad = { username };
  const jwtToken = jwt.sign(payLoad, "SECRET_KEY");
  const userCheckQuery = `
    SELECT * FROM Users WHERE username = '${username}';`;
  const dbUser = await db.get(userCheckQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatches = await bcrypt.compare(
      password_hash,
      dbUser.password_hash
    );
    if (isPasswordMatches) {
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Create API

app.post("/newtasks/", authenticateToken, async (request, response) => {
  const {
    title,
    description,
    status,
    assignee_id,
    created_at,
    updated_at,
  } = request.body;
  const createTaskQuery = ` insert into Tasks(title,description,status,assignee_id,created_at,updated_at)
    values('${title}','${description}','${status}','${assignee_id}','${created_at}','${updated_at}');`;
  const createTaskQueryResponse = await db.run(createTaskQuery);
  response.send(`Player Added to Team`);
});

//Retrieve all tasks
app.get("/tasks/", async (request, response) => {
  const getTasksQuery = `select * from Tasks`;
  const getTasksQueryResponse = await db.all(getTasksQuery);
  response.send(getTasksQueryResponse);
});

//Retrieve specific Task with id
app.get("/tasks/:id", async (request, response) => {
  const { id } = request.params;
  const getSelectedTask = `select * from Tasks where assignee_id='${id}';`;
  const getSelectedTaskResponse = await db.get(getSelectedTask);
  response.send(getSelectedTaskResponse);
});

//Update specific task by id
app.put("/tasks/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const { title, description, status } = request.body;
  const updateTaskDetailsQuery = `update Tasks set 
  title = '${title}' , description = '${description}' , status = '${status}' 
  where assignee_id = '${id}';`;
  const updatedResponse = await db.run(updateTaskDetailsQuery);
  response.send("task updated sucessfully");
});

//Delete specific task by id
app.delete("/tasks/:id/", async (request, response) => {
  const { id } = request.params;
  const deleteTaskQuery = `
  DELETE FROM
    Tasks
  WHERE
    assignee_id = '${id}';`;
  await db.run(deleteTaskQuery);
  response.send("Task Removed");
});

module.exports = app;

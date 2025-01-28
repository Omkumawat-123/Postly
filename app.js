const express = require("express");
const app = express(); 
const userModel = require("./models/user"); // Import the user model for database interaction.
const postModel = require("./models/post"); 
const cookieParser = require("cookie-parser"); 
const bcrypt = require("bcrypt"); 
const jwt = require("jsonwebtoken"); 
const upload=require("./config/multerconfig");   
const path = require("path");

app.set("view engine", "ejs");     // Set the templating engine to EJS for rendering dynamic views.
app.use(express.json());           // Middleware to parse incoming JSON payloads.
app.use(express.urlencoded({ extended: true }));  // Middleware to parse URL-encoded data from forms.
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());          // Middleware to parse cookies from incoming requests.
//const token = jwt.sign({ userId: user.id }, "your-secret-key", { expiresIn: "7d" });

// Home route - Renders the main page.
app.get("/", function (req, res) {
  res.render("index"); // Render the `index.ejs` view.
});

// Login page route - Renders the login form.
app.get("/login", function (req, res) {
  res.render("login"); // Render the `login.ejs` view.
});

app.get("/profile/upload", function (req, res) {
  res.render("uploadprofile"); 
});

app.post("/upload",isLoggedIn, upload.single("image"), async function (req, res) {
  let user=await userModel.findOne({email:req.user.email});
  user.profilepic = req.file.filename;       //Save the uploaded file's filename as the profile picture   
   await user.save()
   res.redirect("/profile");
});


// Profile route - Protected route, accessible only if the user is logged in.
app.get("/profile", isLoggedIn, async function (req, res) {
    let user= await userModel.findOne({email:req.user.email}).populate("posts")   
  res.render("profile" ,{user}); 
});


app.get("/like/:id", isLoggedIn, async function (req, res) {
  let post= await postModel.findOne({_id:req.params.id}).populate("user")  
  if(post.likes.indexOf(req.user.userid)=== -1) {
    post.likes.push(req.user.userid);
  }
  else{
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();
  res.redirect("/profile"); 
});


app.get("/edit/:id", isLoggedIn, async function (req, res) {
  let post= await postModel.findOne({_id:req.params.id}).populate("user")  
  res.render("edit", {post}); 
});


app.post("/update/:id", isLoggedIn, async function (req, res) {
  let post= await postModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content}) ; 
  res.redirect("/profile"); 
});


app.post("/post", isLoggedIn, async function (req, res) {
  let user= await userModel.findOne({email:req.user.email})     
  let {content}=req.body;
  let post = await postModel.create({
    user:user._id,
    content
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile")

});


// Register route - Handles user registration.
app.post("/register", async function (req, res) {
  const { username, name, email, password, age } = req.body; // Extract user details from the request body.

  // Check if a user with the same email already exists.
  const user = await userModel.findOne({ email });
  if (user) return res.status(400).send("User already registered"); // Respond with an error if the user exists.

  // Hash the password securely before saving the user.
  bcrypt.genSalt(10, function (err, salt) {
    if (err) return res.status(500).send("Error generating salt"); // Handle salt generation errors.

    bcrypt.hash(password, salt, async function (err, hash) {
      if (err) return res.status(500).send("Error hashing password"); // Handle hashing errors.

      // Save the new user to the database with the hashed password.
      const newUser = await userModel.create({
        username,
        email,
        age,
        name,
        password: hash,
      });

      // Generate a JWT token for the user.
      const token = jwt.sign(
        { email: email, userid: newUser._id }, // Payload data: email and user ID.
        "key" );

      // Set the token in an HTTP-only cookie for security.
      res.cookie("token", token);
      res.send("Registered successfully"); // Respond with a success message.
    });
  });
});

// Login route - Handles user login.
app.post("/login", async function (req, res) {
  const { email, password } = req.body; // Extract login credentials from the request body.

  // Find the user by email in the database.
  const user = await userModel.findOne({ email });
  if (!user) return res.status(400).send("User not found"); // Respond if the user does not exist.

  // Compare the provided password with the hashed password in the database.
  bcrypt.compare(password, user.password, function (err, result) {

    if (result) {
      // If the password matches, generate a JWT token.
      const token = jwt.sign({ userId: user.id }, "key") // Payload data.
           // Secret key for signing the token.
        res.cookie("token", token);
        res.status(200).redirect("/profile");
       }
     else 
      res.redirect("/login"); // Redirect to the login page if the password does not match.
    
  });
});

// Logout route - Clears the authentication cookie to log out the user.
app.get("/logout", function (req, res) {
  res.cookie("token", ""); // Clear the token cookie by setting it to an empty value and expiring it immediately.
  res.redirect("/login"); // Redirect to the login page.
});


// Middleware to check if the user is logged in.
function isLoggedIn(req, res, next) {
  if (!req.cookies.token) {
    // If no token is found, send an error message.
    return res.redirect("login");
  }
  else{
    // Verify the token and attach the payload to `req.user`
    const data = jwt.verify(req.cookies.token, "key");
    req.user = data;
    next();// Proceed to the next middleware or route handler.
  }
  
}

// Start the server on port 3000.
app.listen(3000) 


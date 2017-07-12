var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser')

var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User = require('./app/models/user'); // get our User model
var Group = require('./app/models/group'); // get our Group model
var PublicGroupOwner = require('./app/models/publicGroupMember'); // get our PublicGroup model

var port = process.env.PORT || 3000;
mongoose.connect(config.database);
app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(cookieParser());

// use morgan to log requests to the console
app.use(morgan('dev'));

// basic route
app.get('/', function (req, res) {
    res.send('Hello! The REST API endpoint is http://localhost:' + port + '/api');
});

// get an instance of the router for api routes
var apiRoutes = express.Router();


// COMMON

function checkBodyParams(req, res) {
    var body = req.body;
    for (var i = 2; i < arguments.length; i++) {
        if (!req.body[arguments[i]]) {
            res.json({
                "success": false,
                "message": "Bad params",
                "data": {}
            });
            throw 'Bad params';
        };
    }
}

// COMMON


// Route for Authentication (POST http://localhost:8080/api/auth)
apiRoutes.post('/auth/login', function (req, res) {

    // find the user
    User.findOne({
        email: req.body.email
    }, function (err, user) {

        if (err) throw err;

        if (!user) {
            res.json({
                "success": false,
                "message": "Authentication failed. User not found.",
                "data": {}
            });
        } else if (user) {

            // check if password matches
            if (user.password != req.body.password) {
                res.json({
                    "success": false,
                    "message": "Authentication failed. Wrong password.",
                    "data": {}
                });
            } else {

                // Create our JWT
                var token = jwt.sign(user, app.get('superSecret'), {
                    expiresInMinutes: 2880 // expires in 48 hours
                });

                res.cookie('jwt_token_value', token, {maxAge: 900000, httpOnly: true});

                // Return the information including the generated token as JSON for use in the client app
                res.json({
                    "success": true,
                    "message": "You are now authenticated!",
                    "data": {
                        token: token,
                        user: user
                    }
                });

            }

        }

    });
});


apiRoutes.use(function (req, res, next) {

    var token = req.body.token || req.query.token || req.headers['x-access-token'] || req.cookies['jwt_token_value'];

    if (token) {
        // Make sure the secret is correct
        jwt.verify(token, app.get('superSecret'), function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.', data: {}});
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        // Return a 403 and block access
        return res.status(403).send({
            success: false,
            message: 'No token provided.',
            data: {}
        });

    }
});

apiRoutes.get('/', function (req, res) {
    res.json({message: 'Welcome PartyNetworkApp!'});
});

// Register user
apiRoutes.post('/auth/register', function (req, res) {
    checkBodyParams(req, res, 'email', 'login', 'password');

    User.findOne({
        email: req.body.email
    }, function (err, user) {

        if (err) {
            res.json({
                "success": false,
                "message": "Error - creating user",
                "data": {}
            });
            throw err;
        }

        if (!user) {
            var newUser = new User({
                login: req.body.login,
                email: req.body.email,
                password: req.body.password,
                avatarUrl: '',
                preferredPublicGroup: '',
                openId: '',
                description: '',
                creationDate: new Date()
            });

            newUser.save(function (err, userItem) {
                if (err) throw err;
                console.log(req.body.login + ' user created');
            });

            var token = jwt.sign(user, app.get('superSecret'), {
                expiresInMinutes: 2880 // expires in 48 hours
            });

            res.cookie('jwt_token_value', token, {maxAge: 2880, httpOnly: true});
            res.json({
                "success": true,
                "message": "User created",
                "data": {
                    'token': token,
                    'user:': newUser
                }
            });

        } else if (user) {
            res.json({
                "success": false,
                "message": "User already exist",
                "data": {}
            });
        }

    });

});


// Apply our defines routes to this endpoint
app.use('/rest', apiRoutes);


// Populate the mongodb database with our admin user
app.get('/setup', function (req, res) {

    // Create an admin user for our API
    var user = new User({
        login: 'user@mail.com',
        email: 'user@mail.com',
        password: 'password',
        avatarUrl: 'http://avatarurl.pl',
        preferredPublicGroup: 'IdGruop',
        openId: '',
        description: 'test Description',
        creationDate: new Date(),
        admin: true
    });

    // Create an admin user for our API
    var group = new Group({
        name: 'Grupa Pierwsza',
        type: 'public',
        parentGroupId: 'root',
        description: 'Opis grupy publicznej',
        avatar: 'avatar url'
    });

    user.collection.remove();
    group.collection.remove();

    // Save the user
    user.save(function (err, userItem) {
        if (err) throw err;
        console.log('Admin user created');
    }).then(function (userItem, userItem2) {

        // Save the user
        group.save(function (err, groupItem) {
            var groupMember = new PublicGroupOwner({
                groupId: groupItem._id,
                userId: userItem._id
            });

            groupMember.save();
            console.log('Group created');
        });

        // User.findOne({ }, function (err, userItem) {
        //     console.log('%s', userItem);
        // })
    });
    res.json({success: true});
});

app.listen(port);
console.log('Running at http://localhost:' + port);

// Imports the express Node module.
var express = require('express');
// Creates an Express server.
var app = express();
// Parses response bodies.
var bodyParser = require('body-parser');
var database = require('./database');
var readDocument = database.readDocument;
var writeDocument = database.writeDocument;
var deleteDocument = database.deleteDocument;
var addDocument = database.addDocument;
var getCollection = database.getCollection;
var StatusUpdateSchema = require('./schemas/statusupdate.json');
var CommentSchema = require('./schemas/comment.json');
var validate = require('express-jsonschema').validate;
var mongo_express = require('mongo-express/lib/middleware');
// Import the default Mongo Express configuration
var mongo_express_config = require('mongo-express/config.default.js');

var MongoDB = require('mongodb');
var MongoClient = MongoDB.MongoClient;
var ObjectID = MongoDB.ObjectID;
var url = 'mongodb://localhost:27017/facebook';

MongoClient.connect(url, function(err, db) {
app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(express.static('../client/build'));
app.use('/mongo_express', mongo_express(mongo_express_config));

/**
 * Resolves a list of user objects. Returns an object that maps user IDs to
 * user objects.
 */
function resolveUserObjects(userList, callback) {
  // Special case: userList is empty.
  // It would be invalid to query the database with a logical OR
  // query with an empty array.
  if (userList.length === 0) {
    callback(null, {});
  } else {
    // Build up a MongoDB "OR" query to resolve all of the user objects
    // in the userList.
    var query = {
      $or: userList.map((id) => { return {_id: id } })
    };
    // Resolve 'like' counter
    db.collection('users').find(query).toArray(function(err, users) {
      if (err) {
        return callback(err);
      }
      // Build a map from ID to user object.
      // (so userMap["4"] will give the user with ID 4)
      var userMap = {};
      users.forEach((user) => {
        userMap[user._id] = user;
      });
      callback(null, userMap);
    });
  }
}

/**
 * Resolves a feed item. Internal to the server, since it's synchronous.
 * @param feedItemId The feed item's ID. Must be an ObjectID.
 * @param callback Called when the operation finishes. First argument is an error object,
 *   which is null if the operation succeeds, and the second argument is the
 *   resolved feed item.
 */
function getFeedItem(feedItemId, callback) {
  // Get the feed item with the given ID.
  db.collection('feedItems').findOne({
    _id: feedItemId
  }, function(err, feedItem) {
    if (err) {
      // An error occurred.
      return callback(err);
    } else if (feedItem === null) {
      // Feed item not found!
      return callback(null, null);
    }

    // Build a list of all of the user objects we need to resolve.
    // Start off with the author of the feedItem.
    var userList = [feedItem.contents.author];
    // Add all of the user IDs in the likeCounter.
    userList = userList.concat(feedItem.likeCounter);
    // Add all of the authors of the comments.
    feedItem.comments.forEach((comment) => userList.push(comment.author));
    // Resolve all of the user objects!
    resolveUserObjects(userList, function(err, userMap) {
      if (err) {
        return callback(err);
      }
      // Use the userMap to look up the author's user object
      feedItem.contents.author = userMap[feedItem.contents.author];
      // Look up the user objects for all users in the like counter.
      feedItem.likeCounter = feedItem.likeCounter.map((userId) => userMap[userId]);
      // Look up each comment's author's user object.
      feedItem.comments.forEach((comment) => {
        comment.author = userMap[comment.author];
      });
      // Return the resolved feedItem!
      callback(null, feedItem);
    });
  });
}

/**
 * Get the feed data for a particular user.
 * @param user The ObjectID of the user document.
 */
function getFeedData(user, callback) {
  db.collection('users').findOne({
    _id: user
  }, function(err, userData) {
    if (err) {
      return callback(err);
    } else if (userData === null) {
      // User not found.
      return callback(null, null);
    }

    db.collection('feeds').findOne({
      _id: userData.feed
    }, function(err, feedData) {
      if (err) {
        return callback(err);
      } else if (feedData === null) {
        // Feed not found.
        return callback(null, null);
      }

      // We will place all of the resolved FeedItems here.
      // When done, we will put them into the Feed object
      // and send the Feed to the client.
      var resolvedContents = [];

      // processNextFeedItem is like an asynchronous for loop:
      // It performs processing on one feed item, and then triggers
      // processing the next item once the first one completes.
      // When all of the feed items are processed, it completes
      // a final action: Sending the response to the client.
      function processNextFeedItem(i) {
        // Asynchronously resolve a feed item.
        getFeedItem(feedData.contents[i], function(err, feedItem) {
          if (err) {
            // Pass an error to the callback.
            callback(err);
          } else {
            // Success!
            resolvedContents.push(feedItem);
            if (resolvedContents.length === feedData.contents.length) {
              // I am the final feed item; all others are resolved.
              // Pass the resolved feed document back to the callback.
              feedData.contents = resolvedContents;
              callback(null, feedData);
            } else {
              // Process the next feed item.
              processNextFeedItem(i + 1);
            }
          }
        });
      }

      // Special case: Feed is empty.
      if (feedData.contents.length === 0) {
        callback(null, feedData);
      } else {
        processNextFeedItem(0);
      }
    });
  });
}

/**
 * Get the user ID from a token. Returns -1 (an invalid ID) if it fails.
 */
function getUserIdFromToken(authorizationLine) {
  try {
    // Cut off "Bearer " from the header value.
    var token = authorizationLine.slice(7);
    // Convert the base64 string to a UTF-8 string.
    var regularString = new Buffer(token, 'base64').toString('utf8');
    // Convert the UTF-8 string into a JavaScript object.
    var tokenObj = JSON.parse(regularString);
    var id = tokenObj['id'];
    // Check that id is a number.
    if (typeof id === 'number') {
      return id;
    } else {
      // Not a number. Return -1, an invalid ID.
      return "";
    }
  } catch (e) {
    // Return an invalid ID.
    return -1;
  }
}

/**
 * Get the feed data for a particular user.
 */
app.get('/user/:userid/feed', function(req, res) {
  var userid = req.params.userid;
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  if (fromUser === userid) {
    // Convert userid into an ObjectID before passing it to database queries.
    getFeedData(new ObjectID(userid), function(err, feedData) {
      if (err) {
        // A database error happened.
        // Internal Error: 500.
        res.status(500).send("Database error: " + err);
      } else if (feedData === null) {
        // Couldn't find the feed in the database.
        res.status(400).send("Could not look up feed for user " + userid);
      } else {
        // Send data.
        res.send(feedData);
      }
    });
  } else {
    // 403: Unauthorized request.
    res.status(403).end();
  }
});

/**
 * Adds a new status update to the database.
 */
function postStatusUpdate(user, location, contents, image) {
  // If we were implementing this for real on an actual server, we would check
  // that the user ID is correct & matches the authenticated user. But since
  // we're mocking it, we can be less strict.

  // Get the current UNIX time.
  var time = new Date().getTime();
  // The new status update. The database will assign the ID for us.
  var newStatusUpdate = {
    "likeCounter": [],
    "type": "statusUpdate",
    "contents": {
      "author": user,
      "postDate": time,
      "location": location,
      "contents": contents,
      "image": image,
      "likeCounter": []
    },
    // List of comments on the post
    "comments": []
  };

  // Add the status update to the database.
  // Returns the status update w/ an ID assigned.
  newStatusUpdate = addDocument('feedItems', newStatusUpdate);

  // Add the status update reference to the front of the current user's feed.
  var userData = readDocument('users', user);
  var feedData = readDocument('feeds', userData.feed);
  feedData.contents.unshift(newStatusUpdate._id);

  // Update the feed object.
  writeDocument('feeds', feedData);

  // Return the newly-posted object.
  return newStatusUpdate;
}

//`POST /feeditem { userId: user, location: location, contents: contents  }`
app.post('/feeditem', validate({ body: StatusUpdateSchema }), function(req, res) {
  // If this function runs, `req.body` passed JSON validation!
  var body = req.body;
  var fromUser = getUserIdFromToken(req.get('Authorization'));

  // Check if requester is authorized to post this status update.
  // (The requester must be the author of the update.)
  if (fromUser === body.userId) {
    var newUpdate = postStatusUpdate(body.userId, body.location, body.contents, body.image);
    // When POST creates a new resource, we should tell the client about it
    // in the 'Location' header and use status code 201.
    res.status(201);
    res.set('Location', '/feeditem/' + newUpdate._id);
     // Send the update!
    res.send(newUpdate);
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

// `PUT /feeditem/feedItemId/likelist/userId` content
app.put('/feeditem/:feeditemid/likelist/:userid', function(req, res) {

  // Convert params from string to number.
  var feedItemId = parseInt(req.params.feeditemid, 10);

  var userId = req.params.userid;
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    if (fromUser === userId) {
    var feedItem = readDocument('feedItems', feedItemId);
    // Add to likeCounter if not already present.
    if (feedItem.likeCounter.indexOf(userId) === -1) {
      feedItem.likeCounter.push(userId);
      writeDocument('feedItems', feedItem);
    }
    // Return a resolved version of the likeCounter
    res.send(feedItem.likeCounter.map((userId) => readDocument('users', userId)));
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

// Unlike a feed item.
app.delete('/feeditem/:feeditemid/likelist/:userid', function(req, res) {

  // Convert params from string to number.
  var feedItemId = parseInt(req.params.feeditemid, 10);

  var userId = req.params.userid;
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    if (fromUser === userId) {
    var feedItem = readDocument('feedItems', feedItemId);
    var likeIndex = feedItem.likeCounter.indexOf(userId);
    // Remove from likeCounter if present
    if (likeIndex !== -1) {
      feedItem.likeCounter.splice(likeIndex, 1);
      writeDocument('feedItems', feedItem);
    }
    // Return a resolved version of the likeCounter
    res.send(feedItem.likeCounter.map((userId) => readDocument('users', userId)));
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

// `PUT /feeditem/feedItemId/content newContent`
app.put('/feeditem/:feeditemid/content', function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var feedItemId = req.params.feeditemid;
  var feedItem = readDocument('feedItems', feedItemId);
  // Check that the requester is the author of this feed item.
  if (fromUser === feedItem.contents.author) {
    // Check that the body is a string, and not something like a JSON object.
    // We can't use JSON validation here, since the body is simply text!
    if (typeof(req.body) !== 'string') {
      // 400: Bad request.
      res.status(400).end();
      return;
    }
    // Update text content of update.
    feedItem.contents.contents = req.body;
    writeDocument('feedItems', feedItem);
    res.send(getFeedItemSync(feedItemId));
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

// `DELETE /feeditem/:id`
app.delete('/feeditem/:feeditemid', function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  // Convert from a string into a number.
  var feedItemId = parseInt(req.params.feeditemid, 10);
  var feedItem = readDocument('feedItems', feedItemId);
  // Check that the author of the post is requesting the delete.
  if (feedItem.contents.author === fromUser) {
    deleteDocument('feedItems', feedItemId);
    // Remove references to this feed item from all other feeds.
    var feeds = getCollection('feeds');
    var feedIds = Object.keys(feeds);
    feedIds.forEach((feedId) => {
      var feed = feeds[feedId];
      var itemIdx = feed.contents.indexOf(feedItemId);
      if (itemIdx !== -1) {
        // Splice out of array.
        feed.contents.splice(itemIdx, 1);
        // Update feed.
        database.writeDocument('feeds', feed);
      }
    });
    // Send a blank response to indicate success.
    res.send();
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

//`POST /search queryText`
app.post('/search', function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var user = readDocument('users', fromUser);
  if (typeof(req.body) === 'string') {
    // trim() removes whitespace before and after the query.
    // toLowerCase() makes the query lowercase.
    var queryText = req.body.trim().toLowerCase();
    // Search the user's feed.
    var feedItemIDs = readDocument('feeds', user.feed).contents;
    // "filter" is like "map" in that it is a magic method for
    // arrays. It takes an anonymous function, which it calls
    // with each item in the array. If that function returns 'true',
    // it will include the item in a return array. Otherwise, it will
    // not.
    // Here, we use filter to return only feedItems that contain the
    // query text.
    // Since the array contains feed item IDs, we later map the filtered
    // IDs to actual feed item objects.
    res.send(feedItemIDs.filter((feedItemID) => {
      var feedItem = readDocument('feedItems', feedItemID);
      return feedItem.contents.contents.toLowerCase().indexOf(queryText) !== -1;
    }).map(getFeedItemSync));
  } else {
    // 400: Bad Request.
    res.status(400).end();
  }
});

// Post a comment
app.post('/feeditem/:feeditemid/comments', validate({ body: CommentSchema }), function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var comment = req.body;
  var author = req.body.author;
  var feedItemId = req.params.feeditemid;
  if (fromUser === author) {
    var feedItem = readDocument('feedItems', feedItemId);
    // Initialize likeCounter to empty.
    comment.likeCounter = [];
    // Push returns the new length of the array.
    // The index of the new element is the length of the array minus 1.
    // Example: [].push(1) returns 1, but the index of the new element is 0.
    var index = feedItem.comments.push(comment) - 1;
    writeDocument('feedItems', feedItem);
    // 201: Created.
    res.status(201);
    res.set('Location', '/feeditem/' + feedItemId + "/comments/" + index);
    // Return a resolved version of the feed item.
    res.send(getFeedItemSync(feedItemId));
  } else {
    // Unauthorized.
    res.status(401).end();
  }
});

app.put('/feeditem/:feeditemid/comments/:commentindex/likelist/:userid', function(req, res) {

  var feedItemId = parseInt(req.params.feeditemid, 10);
  var commentIdx = parseInt(req.params.commentindex, 10);
  // Only a user can mess with their own like.
  var userId = req.params.userid;
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    if (fromUser === userId) {
    var feedItem = readDocument('feedItems', feedItemId);
    var comment = feedItem.comments[commentIdx];
    // Only change the likeCounter if the user isn't in it.
    if (comment.likeCounter.indexOf(userId) === -1) {
      comment.likeCounter.push(userId);
    }
    writeDocument('feedItems', feedItem);
    comment.author = readDocument('users', comment.author);
    // Send back the updated comment.
    res.send(comment);
  } else {
    // Unauthorized.
    res.status(401).end();
  }
});

app.delete('/feeditem/:feeditemid/comments/:commentindex/likelist/:userid', function(req, res) {

  var feedItemId = parseInt(req.params.feeditemid, 10);
  var commentIdx = parseInt(req.params.commentindex, 10);
  // Only a user can mess with their own like.
  var userId = req.params.userid;
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    if (fromUser === userId) {
    var feedItem = readDocument('feedItems', feedItemId);
    var comment = feedItem.comments[commentIdx];
    var userIndex = comment.likeCounter.indexOf(userId);
    if (userIndex !== -1) {
      comment.likeCounter.splice(userIndex, 1);
      writeDocument('feedItems', feedItem);
    }
    comment.author = readDocument('users', comment.author);
    res.send(comment);
  } else {
    // Unauthorized.
    res.status(401).end();
  }
});

// Reset database.
app.post('/resetdb', function(req, res) {
  console.log("Resetting database...");
  // This is a debug route, so don't do any validation.
  database.resetDatabase();
  res.send();
});

/**
 * Translate JSON Schema Validation failures into error 400s.
 */
app.use(function(err, req, res, next) {
  if (err.name === 'JsonSchemaValidation') {
    // Set a bad request http response status
    res.status(400).end();
  } else {
    // It's some other sort of error; pass it to next error middleware handler
    next(err);
  }
});

// Starts the server on port 3000!
app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});




  // Put everything that uses `app` into this callback function.
  // from app.use(bodyParser.text());
  // all the way to
  // app.listen(3000, ...
  // Also put all of the helper functions that use mock database
  // methods like readDocument, writeDocument, ...
});
// The file ends here. Nothing should be after this.

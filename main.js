var app = require('http').createServer(handler),
	io = require('socket.io').listen(app, { log: false }),
	fs = require('fs'),
	_ = require('underscore'),
	games = [],
	users = [],
	minUsersPerGame = 1;

var jsonify = function(obj) {
	return JSON.stringify(obj, null, 4);
};

var getRandy = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var readPuzzles = function() {
	try {	
		var data = fs.readFileSync(__dirname + '/puzzles.json');
		var parsedData = JSON.parse(data);
		console.log('Puzzles loaded. ' + jsonify(parsedData));
		return parsedData;
	} catch (err) {		
		console.log('Couldn\'t read puzzles from puzzles.json. Error: ' + jsonify(err));
		return;
	}
};
var puzzles = readPuzzles();

app.listen(8085);

function handler (req, res) {
	fs.readFile(__dirname + req.url, function (err, data) {
		if (err) {
			res.writeHead(500);
			return res.end('Error loading file ' + req.url);
		}
		res.writeHead(200);
		res.end(data);
	});
}

var createUser = function(name, socket) {
	var user = {
		name: name,
		socketId: socket.id
	};
	users.push(user);
	return user;
};

var findUser = function(userSocketId, userList) {
	user = _.find(userList, function(u) {
		return (u.socketId == userSocketId);
	});
	return user;
};

var getUser = function(socket) {
	var user = null;
	if (!!socket) {
		user = findUser(socket.id, users);
	}
	return user;
};

var getPlayer = function(user, game) {
	var user = findUser(user.socketId, game.players);
	return user;
};

var getOrCreateUser = function(name, socket) {
	var user = getUser(socket) || createUser(name, socket);
	return user;
};

var createGame = function() {
	var game = {
		players: [],
		puzzle: puzzles[getRandy(0, 2)],
		started: false
	};
	games.push(game);
	
	game.puzzle.slotCount = _.countBy(game.puzzle.prompt, function(val) {
		return _.isNull(val);
	});
	
	_.each(game.puzzle.pieces, function(piece) {
		piece.placedAt = -1;
	});
	
	//Notify users of a new game being created
	console.log('emit-all: gameCreated');
	io.sockets.emit('gameCreated', sanitizeGame(game));

	return game;
};

var getGame = function() {
	var game = games[0];
	return game;
};

var getOrCreateGame = function() {
	var game = getGame() || createGame();
	return game;
};

var sanitizeGame = function(game) {
	var sanGame = {};
	sanGame.players = _.clone(game.players);
	sanGame.puzzle = _.clone(game.puzzle);
	delete sanGame.puzzle.solution;
	return sanGame;
};

var getPiece = function(pieceId, pieces) {
	var piece = _.find(pieces, function(pc) {
		return (pc.id == pieceId);
	});
	return piece;
};

var getHeldPiece = function(user, pieces) {
	var piece = _.find(pieces, function(pc) {
		return (!!pc.heldBy && pc.heldBy.socketId == user.socketId);
	});
	return piece;
};

var getPieceInSlot = function(slotIdx, pieces) {
	if (slotIdx < 0) {
		return null;
	}
	var piece = _.find(pieces, function(pc) {
		return (pc.placedAt == slotIdx);
	});
	return piece;
};

var dropPiece = function(user, game) {
	var piece = getHeldPiece(user, game.puzzle.pieces);
	
	if (!piece) {
		console.log('dropPiece() ignored; user not holding a piece');
		return; //nothing to do
	}
	
	delete piece.heldBy //drop the piece
	
	//Notify all users of piece drop
	console.log('emit-all: pieceDropped | ' + jsonify({piece: piece}));
	io.sockets.emit('pieceDropped', {piece: piece});
};

var isPuzzleSolved = function(game) {
	var success = true;
	_.each(game.puzzle.pieces, function(piece) {
		if (piece.placedAt < 0 || game.puzzle.solution[piece.placedAt] != piece.value) {
			success = false;
		}
	});
	return success;
};

var placePieceAt = function(piece, slotPiece, slotIdx, game) {
	var previousSlotIdx = piece.placedAt;
	piece.placedAt = slotIdx;
	delete piece.heldBy; //let go of the piece
	
	//Notify all users of piece placements
	if (slotPiece != null) {
		//Need to swap pieces!
		slotPiece.placedAt = previousSlotIdx;
		console.log('emit-all: piecePlaced | ' + jsonify({piece: slotPiece}));
		io.sockets.emit('piecePlaced', {piece: slotPiece});
	} else {
		if (previousSlotIdx != -1) {
			console.log('emit-all: slotCleared | ' + jsonify({slotIdx: previousSlotIdx}));
			io.sockets.emit('slotCleared', {slotIdx: previousSlotIdx});
		}
	}
	console.log('emit-all: piecePlaced | ' + jsonify({piece: piece}));
	io.sockets.emit('piecePlaced', {piece: piece});
	
	//Check for puzzle completion
	if (isPuzzleSolved(game)) {
		console.log('emit-all: puzzleSolved | ' + jsonify({game: game}));
		io.sockets.emit('puzzleSolved', game);
		setTimeout(function() {
			var game = createGame();
			_.each(users, function(user) {
				game.players.push(user);
			});
			console.log('emit-all: gameStarted | ' + jsonify({game: sanitizeGame(game)}));
			io.sockets.emit('gameStarted', sanitizeGame(game));
		}, 1000);
	}
};

var getUserIdx = function(user, userList) {
	for (var i = 0; i < userList.length; i++) {
		if (userList[i].socketId == user.socketId) {
			return i;
		}
	}
	return null;
};

var getStatus = function() {
	return {
		games: games,
		users: users
	};
};

var handleGetStatus = function(socket, data, callback) {
	console.log('emit: status');
	socket.emit('status', getStatus());
};

var handleJoinGame = function(socket, data, callback) {
	// data:
	// {
	//     name: 'Hank Hill'
	// }
	if (_.isEmpty(data) || _.isUndefined(data.name)) {
		//data.name is a required parameter value
		if (!!callback) {
			callback(false);
		}
		console.log('handleJoinGame() failed; required parameters missing');
		return;
	}
	
	//Get or create a game
	var game = getOrCreateGame();
		
	//Get or create the user
	var user = getOrCreateUser(data.name, socket);
	
	if (!getPlayer(user, game)) {
		console.log('Player not in game; joining now...');
		//Add user to game
		game.players.push(user);
	
		//Notify users of new player
		console.log('emit-all: playerJoined');
		io.sockets.emit('playerJoined', {player: user, players: game.players});
		
		//Start game if minUsers threshold met
		if (game.started) {
			//Game already started; courtesy notification just to the requesting user
			//console.log('Game already in progress, notifying gameStarted to connecting player.');
			console.log('emit: gameStarted');
			socket.emit('gameStarted', sanitizeGame(game));
		} else if (game.players.length >= minUsersPerGame) {
			game.started = true;
			//Notify users of game starting
			//console.log('Game starting now; notifying gameStarted to all connected players.');
			console.log('emit-all: gameStarted');
			io.sockets.emit('gameStarted', sanitizeGame(game));
		}
	} else {
		console.log('Player already in game.');
		//Game started and user already in game; courtesy notification just to the requesting user
		if (game.started) {
			//console.log('Game already in progress & user already joined; notifying gameStarted to (re)connecting player.');
			console.log('emit: gameStarted');
			socket.emit('gameStarted', sanitizeGame(game));
		}
	}
	
	if (!!callback) {
		callback(true);
	}
};

var handleGrabPiece = function(socket, data, callback) {
	// data:
	// {
	//     pieceId: 3 //array index of piece
	// }
	if (_.isEmpty(data) || _.isUndefined(data.pieceId)) {
		//data.pieceId is a required parameter value
		if (!!callback) {
			callback(false);
		}
		console.log('handleGrabPiece() failed; required parameters missing');
		return;
	}
	
	var game = getGame();
	var user = getUser(socket);
	if (!game || !user) {
		if (!!callback) {
			callback(false);
		}
		console.log('handleGrabPiece() failed; game or user is null');
		return;
	}
	
	var piece = getPiece(data.pieceId, game.puzzle.pieces);
	if (!piece) {
		if (!!callback) {
			callback(false);
		}
		console.log('handleGrabPiece() failed; invalid pieceId specified');
		return;
	}
	
	if (!!getHeldPiece(user, game.puzzle.pieces)) {
		if (!!callback) {
			callback(false);
		}
		console.log('handleGrabPiece() failed; user is already holding a piece');
		return;
	}
	
	if (!!piece.heldBy) {
		if (!!callback) {
			callback(false);
		}
		console.log('handleGrabPiece() failed; piece already held by another user');
		return;
	}
	
	piece.heldBy = user;
	
	//Notify all users of piece picked up
	console.log('emit-all: pieceGrabbed | ' + jsonify({piece: piece}));
	io.sockets.emit('pieceGrabbed', {piece: piece});
	
	if (!!callback) {
		callback(true);
	}
};

var handlePlacePiece = function(socket, data, callback) {
	// data:
	// {
	//     slotIdx:
	//     pieceId:
	// }
	if (_.isEmpty(data) || _.isUndefined(data.slotIdx) || _.isUndefined(data.pieceId)) {
		//data.slotIdx and data.pieceId are required parameter values
		if (!!callback) {
			callback(false);
		}
		console.log('handlePlacePiece() failed; required parameters missing');
		return;
	}
	
	var game = getGame();
	var user = getUser(socket);
	if (!game || !user) {
		if (!!callback) {
			callback(false);
		}
		console.log('handlePlacePiece() failed; game or user is null');
		return;
	}
	
	var piece = getHeldPiece(user, game.puzzle.pieces);
	if (!piece) {
		if (!!callback) {
			callback(false);
		}
		console.log('handlePlacePiece() failed; user isn\'t holding a piece');
		return;
	}
	if (piece.id != data.pieceId) {
		if (!!callback) {
			callback(false);
		}
		console.log('handlePlacePiece() failed; mismatch of expected pieceId vs piece currently held by user');
		return;
	}
	
	if (data.slotIdx < -1 || data.slotIdx > game.puzzle.slotCount - 1) {
		if (!!callback) {
			callback(false);
		}
		console.log('handlePlacePiece() failed; specified slot index out of range');
		return;
	}
	
	var slotPiece = getPieceInSlot(data.slotIdx, game.puzzle.pieces);
	if (!!slotPiece && !!slotPiece.heldBy) {
		if (!!callback) {
			callback(false);
		}
		console.log('handlePlacePiece() failed; piece in target slot is held by another user');
		return;
	}
	
	placePieceAt(piece, slotPiece, data.slotIdx, game);
	
	if (!!callback) {
		callback(true);
	}
};

var handleDropPiece = function(socket, data, callback) {
	// data:
	// {
	// }
	var game = getGame();
	var user = getUser(socket);
	if (!game || !user) {
		if (!!callback) {
			callback(false);
		}
		console.log('handleDropPiece() failed; game or user is null');
		return;
	}
	
	dropPiece(user, game);
	
	if (!!callback) {
		callback(true);
	}
};

var handleLeaveGame = function(socket, data, callback) {
	// data:
	// {
	// }
	var game = getGame();
	var user = getUser(socket);
	if (!game || !user) {
		if (!!callback) {
			callback(false);
		}
		console.log('handleLeaveGame() failed; game or user is null');
		return;
	}
	
	//drop any piece the user might be holding before they exit
	dropPiece(user, game);
	
	//remove user from players list
	var playerIdx = getUserIdx(user, game.players);
	if (!_.isNull(playerIdx)) {
		game.players.splice(userIdx, 1);
	}
	
	//remove user from users list
	var userIdx = getUserIdx(user, users);
	if (!_.isNull(userIdx)) {
		users.splice(userIdx, 1);
	}
	
	//Notify users of exited player
	console.log('emit-all: playerQuit');
	io.sockets.emit('playerQuit', {player: user, players: game.players});
	
	//End game if no players remain
	console.log('Players remaining in game: ' + jsonify(game.players));
	if (game.players.length == 0) {
		console.log('emit-all: gameEnded');
		io.sockets.emit('gameEnded', sanitizeGame(game));
		games = []; //not so good if we ever support more than one game! but we won't during THIS hackathon!!!
	}
	
	if (!!callback) {
		callback(true);
	}
};

io.sockets.on('connection', function (socket) {
	//On connect, send status of any currently running game.
	console.log('emit: status');
	socket.emit('status', getStatus());
	
	//User requests status
	socket.on('getStatus', function(data, callback) {
		handleGetStatus(socket, data, callback);
	});
	
	//User requests to join game
	socket.on('joinGame', function(data, callback) {
		handleJoinGame(socket, data, callback);
	});
	
	//User picks up a piece (drag action start)
	socket.on('grabPiece', function(data, callback) {
		handleGrabPiece(socket, data, callback);
	});
	
	//User attempts to place a piece in a puzzle slot
	socket.on('placePiece', function(data, callback) {
		handlePlacePiece(socket, data, callback);
	});
	
	//User drops the piece outside a puzzle slot (should return to bucket)
	socket.on('dropPiece', function(data, callback) {
		handleDropPiece(socket, data, callback);
	});
	
	//User exits the game
	socket.on('leaveGame', function(data, callback) {
		handleLeaveGame(socket, data, callback);
	});
	
	socket.on('disconnect', function() {
		handleLeaveGame(socket);
	});
	
});


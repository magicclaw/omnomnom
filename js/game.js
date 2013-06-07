/*global describe, angular, $, alert, socket */
//above is for jslint to ignore thes




function GameController($scope) {

	$scope.pieces = [];
	$scope.slots = [];
	$scope.players = [];
	$scope.highscores = [];
	var selectedPieceId = null;
	var slotPieceKeyList = [];
	var readyForGameStart = false;
	var gameInSession = false;
	
	var initGame = function(data) {
		$scope.pieces = data.puzzle.pieces;
		$scope.players = data.players;
		$scope.slots = [];
		$scope.highscores = data.highscores;
		slotPieceKeyList = [];
		for(var i = 0; i < data.puzzle.prompt.length;i++) {
			var prompt = data.puzzle.prompt[i];

			if(prompt) {
				$scope.slots.push({value:prompt, cssClass:"notSlot", id:i});
			} else {
				$scope.slots.push({value:"", cssClass:"slot actionableItem", id:i});
			}
		}
		gameInSession = true;
		$scope.$apply();
	};
	
	var refreshGame = function(data) {
		for (var i = 0; i < data.puzzle.pieces.length; i++) {
			var piece = data.puzzle.pieces[i];
			if (piece.placedAt !== -1) {
				assignPieceToSlot(piece.id, piece.value, piece.placedAt);
				hidePieceInBucket(piece.id);
			}
			if (piece.heldBy && piece.heldBy.socketId !== socket.socket.sessionid) {
				if (piece.placedAt == -1) {
					disablePieceInBucket(piece.id);
				} else {
					disablePieceInSlot(piece.placedAt);
				}
			}
		}
		$("#WaitingDiv").addClass("hidden");
		$("#GameDiv").removeClass("hidden");
	};
	
	var showPieceInBucket = function(pieceId) {
		var pieceNode = $('#piece-' + pieceId);
		pieceNode.removeClass("hidden");
	};
	
	var hidePieceInBucket = function(pieceId) {
		var pieceNode = $("#piece-" + pieceId);
		pieceNode.addClass("hidden");
		pieceNode.removeClass("selectedPiece");
	};
	
	var assignPieceToSlot = function(pieceId, pieceValue, slotIdx) {
		var slotNode = $("#slot-" + slotIdx);
		slotNode.removeClass("selectedPiece");
		slotNode.removeClass("untouchable");
		slotNode.html(pieceValue);
		
		slotPieceKeyList[slotIdx] = pieceId;
	};
	
	var removePieceFromSlot = function(slotIdx) {
		var slotNode = $("#slot-" + slotIdx);
		slotNode.html("&nbsp;");
		slotNode.removeClass("selectedPiece");
		slotPieceKeyList[slotIdx] = null;
	};
	
	var selectPieceInBucket = function(pieceId) {
		var pieceNode = $("#piece-" + pieceId);
		pieceNode.addClass("selectedPiece");
	};
	
	var selectPieceInSlot = function(slotIdx) {
		var slotNode = $("#slot-" + slotIdx);
		slotNode.addClass("selectedPiece");
	};
	
	var disablePieceInBucket = function(pieceId) {
		var pieceNode = $("#piece-" + pieceId);
		pieceNode.addClass("untouchable");
	};
	
	var disablePieceInSlot = function(slotIdx) {
		var slotNode = $("#slot-" + slotIdx);
		slotNode.addClass("untouchable");
	};
	
	var enablePieceInBucket = function(pieceId) {
		var pieceNode = $("#piece-" + pieceId);
		pieceNode.removeClass("untouchable");
	};
	
	var enablePieceInSlot = function(slotIdx) {
		var slotNode = $("#slot-" + slotIdx);
		slotNode.removeClass("untouchable");
	};		
	
	var isUserMe = function(user) {
		return (user.socketId === socket.socket.sessionid);
	};

	var getUserIdx = function(user, userList) {
		for (var i = 0; i < userList.length; i++) {
			if (userList[i].socketId == user.socketId) {
				return i;
			}
		}
		return null;
	};
	
	var removeUser = function(user) {
		if (gameInSession) {
			var idx = getUserIdx(user, $scope.players);
			console.log('before user remove: ' + JSON.stringify($scope.players));
			$scope.players.splice(idx, 1);
			console.log('after user remove: ' + JSON.stringify($scope.players));
			$scope.$apply();
		}
	};
	
	var addUser = function(user) {
		if (gameInSession) {
			console.log('before user add: ' + JSON.stringify($scope.players));
			$scope.players.push(user);
			console.log('after user add: ' + JSON.stringify($scope.players));
			$scope.$apply();
		}
	};
	
	var refreshPlayers = function(players) {
		$scope.players = players;
		$scope.$apply();
	};
	
	socket.on("playerQuit", function(data) {
		//removeUser(data.player);
		refreshPlayers(data.players);
	});
	
	socket.on("playerJoined", function(data) {
		if (isUserMe(data.player)) {
			$("#WaitingDiv").removeClass("hidden");
			readyForGameStart = true;
		} else {
			//addUser(data.player);
			refreshPlayers(data.players);
		}		
	});
	
	socket.on("gameStarted", function(data) {
		if (!readyForGameStart) {
			return;
		}
		
		var finishedDiv = $("#FinishedDiv");
		if (!finishedDiv.hasClass("hidden")) {
			if (finishedDiv.dialog) {
				finishedDiv.dialog("close");
			}
			finishedDiv.addClass("hidden");
			$("#GameDiv").removeClass("hidden");
		}
		
		console.log(data);
		initGame(data);
		refreshGame(data);
	});
	
	socket.on("highscoresUpdated", function(data) {
		if (gameInSession) {
			$scope.highscores = data.highscores;
			$scope.$apply();
		}
	});

	$scope.getPieceIdFromSlotId = function(id) {

		return slotPieceKeyList[id];
	};

	$scope.isSelectedPieceInSlot = function() {
		for(key in slotPieceKeyList) {
			if(slotPieceKeyList[key] === selectedPieceId) {
				return true;
			}
		}
		return false;
	};

	$scope.getSelectedPieceId = function() {

		return selectedPieceId;
	};

	$scope.unselectDraggedPiece = function(id) {
		var pieceNode = $("#piece-" + id);
		socket.emit("dropPiece", {pieceId:id});
		pieceNode.removeClass("selectedPiece");
		selectedPieceId = null;
	};

	$scope.unselectDraggedSlot = function(id) {
		var slotNode = $("#slot-" + id);
		socket.emit("dropPiece", {pieceId:id});
		slotNode.removeClass("selectedPiece");
		selectedPieceId = null;
	};
	
	$scope.pieceClick = function(id) {
		var pieceNode = $("#piece-" + id);
		if(!pieceNode.hasClass("selectedPiece")) {
			socket.emit("grabPiece", {pieceId:id}, function(allowable) {
				//if(allowable) {
				//	pieceNode.addClass("selectedPiece");
				//	selectedPieceId = id;
				//}
			});
		}
		else {
			socket.emit("dropPiece", {pieceId:id});
			pieceNode.removeClass("selectedPiece");
			selectedPieceId = null;
		}
		
	};

	$scope.slotDoubleClick = function(id) {
		var slotNode = $("#slot-" + id);
		if(selectedPieceId !== null ) {
			socket.emit("placePiece", {slotIdx:id, pieceId:selectedPieceId}, function(success){
			});
		}
	};
	
	$scope.slotClick = function(id) {
		var slotNode = $("#slot-" + id);
		if((slotPieceKeyList[id] === undefined || slotPieceKeyList[id] === null)  && selectedPieceId !== null) {
			socket.emit("placePiece", {slotIdx:id, pieceId:selectedPieceId}, function(success){
			});
		}
		else if(slotNode.hasClass("selectedPiece") && selectedPieceId === slotPieceKeyList[id]) {
			socket.emit("dropPiece", {pieceId:id});
			slotNode.removeClass("selectedPiece");
			selectedPieceId = null;
		}
		else if(!slotNode.hasClass("selectedPiece")) {

			socket.emit("grabPiece", {pieceId:slotPieceKeyList[id]}, function(allowable) {
			});
			// socket.emit("grabPiece", {pieceId:slotPieceKeyList[id]}, function(allowable) {
			// });
		}
	};
	
	$scope.bucketClick = function(id) {
		if(selectedPieceId !== null && $scope.isSelectedPieceInSlot()) {
			socket.emit("placePiece", {slotIdx:-1, pieceId:selectedPieceId}, function(success) {
			});
		}
	};

	socket.on("piecePlaced", function(data) {
		//data = {"piece":{"id":0,"value":"fox","placedAt":-1,"heldBy":{"name":"Bob Scott","socketId":"PfEGfuXvodxxQx_KHxPb"}}}
		if(data.piece.placedAt === -1) {
			showPieceInBucket(data.piece.id);
			enablePieceInBucket(data.piece.id);
		} else {
			assignPieceToSlot(data.piece.id, data.piece.value, data.piece.placedAt);
			hidePieceInBucket(data.piece.id);
			enablePieceInSlot(data.placedAt);
		}
	});
	
	socket.on("pieceDropped", function(data) {
		if(data.piece.placedAt === -1) {
			enablePieceInBucket(data.piece.id);
		} else {
			enablePieceInSlot(data.placedAt);
		}
	});

	socket.on("slotCleared", function(data) {
		//data = {"slotIdx":1}
		removePieceFromSlot(data.slotIdx);
	});
	
	socket.on("pieceGrabbed", function(data) {
		//data = {"piece":{"id":0,"value":"fox","placedAt":-1,"heldBy":{"name":"Bob Scott","socketId":"PfEGfuXvodxxQx_KHxPb"}}}
		if (socket.socket.sessionid === data.piece.heldBy.socketId) {
			selectedPieceId = data.piece.id;
			if (data.piece.placedAt === -1) {
				selectPieceInBucket(data.piece.id);
			} else {
				selectPieceInSlot(data.piece.placedAt);
			}
		} else {
			if (data.piece.placedAt === -1) {
				disablePieceInBucket(data.piece.id);
			} else {
				disablePieceInSlot(data.piece.placedAt);
			}
		}
	});
}


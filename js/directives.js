/*global describe, angular, $, alert, socket */
//above is for jslint to ignore thes


var Game = angular.module('Game', []);

function onSlotDragStart(id) {

	var scope = angular.element($("#GameDiv")).scope();
	var textObj = { "id" : scope.getPieceIdFromSlotId(id), "node": true}
	event.dataTransfer.setData("Text", JSON.stringify(textObj));
	socket.emit("grabPiece", {pieceId:scope.getPieceIdFromSlotId(id)}, function(allowable) {});

	
}

function onSlotDrop(id) {
	var scope = angular.element($("#GameDiv")).scope();
	scope.unselectDraggedSlot(id);

}

//Draggable events
function onPieceDragStart(id) {
	var textObj = { "id" : id}
	event.dataTransfer.setData("Text", JSON.stringify(textObj));
	socket.emit("grabPiece", {pieceId:id}, function(allowable) {});
}

function onPieceDrop(id) {
	var scope = angular.element($("#GameDiv")).scope();
	scope.unselectDraggedPiece(id);
}

function onPieceDropped(e, id){
	e.preventDefault();
	var textObj = JSON.parse(event.dataTransfer.getData("Text"));
	var pieceId = textObj.id;
	//var pieceId = parseInt(event.dataTransfer.getData("Text"));
	socket.emit("placePiece", {slotIdx:id, pieceId:pieceId}, function(success) {
		if(success) {
		}
	});
}

function allowDroppable(id, nodeId) {
	
	if($("#"+nodeId).hasClass("slot")) {
		
		event.preventDefault();	

	}

	if(id === -1) {
		var scope = angular.element($("#GameDiv")).scope();
		if(scope.isSelectedPieceInSlot()) {
			event.preventDefault();
		}

	}
	
}

// Game.directive('draggable', function() {
//     return {
//         // A = attribute, E = Element, C = Class and M = HTML Comment
//         restrict:'A',
//         link: function(scope, element, attrs) {
//         	$(element).draggable({
//         		revert:"invalid",
//         		start : function(event, ui) {
//         			socket.emit("grabPiece", {pieceId: this.id}, function(success){

//         			});
//         		}
//         	});
//         }
//     };
// });
// Game.directive('droppable', function(){
// 	return {
// 		restrict: 'A',
// 		link: function(scope, element, attrs) {
// 			$(element).droppable({
// 				drop: function(event, ui) {
				
// 					console.log($(ui.draggable));
// 				}
// 			});
// 		}
// 	};
// });


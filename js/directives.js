/*global describe, angular, $, alert, socket */
//above is for jslint to ignore thes


var Game = angular.module('Game', []);

//Draggable events
function onPieceDragStart(id) {
	event.dataTransfer.setData("Text", id);
	socket.emit("grabPiece", {pieceId:id}, function(allowable) {});
}

function onPieceDrop(id) {
	var scope = angular.element($("#GameDiv")).scope();
	scope.unselectDraggedPiece(id);
}

function onPieceDropped(e, id){
	e.preventDefault();
	var pieceId = parseInt(event.dataTransfer.getData("Text"));
	socket.emit("placePiece", {slotIdx:id, pieceId:pieceId}, function(success) {
		if(success) {
		}
	});
}

function allowDroppable(id, nodeId) {

	if($("#"+nodeId).hasClass("slot")) {
		
		event.preventDefault();	

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


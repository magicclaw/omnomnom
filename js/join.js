
/*global describe, angular, $, alert, socket */
//above is for jslint to ignore thes

function JoinController($scope) {
	$scope.validateAndJoin = function(){
		if($scope.yourName) {
			socket.emit("joinGame", {name:$scope.yourName}, function(success){
				$("#JoinDiv").addClass("hidden");
				$("#GameDiv").removeClass("hidden");

			});	
		}
	};
}
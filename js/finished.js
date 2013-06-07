function FinishedController($scope){
	socket.on("puzzleSolved", function(data){
		$("#GameDiv").addClass("hidden");
		$("#FinishedDiv").removeClass("hidden");

		$( "#FinishedDiv" ).dialog({
			height: 480,
			width: 640,
			modal: true
	    });
	});
}
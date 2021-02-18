    if (!("Notification" in window)) {
		load("modalOneB.html", $("body"), function() {
			$("#modalOneB").attr("id", "notiModal");
			$("#notiModal .modal-title").text("Notification support");
			$("#notiModal .modal-body").text("This browser does not support desktop notification");
			$("#notiModal .btn-secondary").text("Close");
			$("#notiModal").on("hidden.bs.modal", function (e) {
				$("#notiModal").remove();
			})
			$("#notiModal").modal("show");
		});
      }
    else if (Notification.permission === "granted") {
        //var notification = new Notification("message");
      }
    else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
          if (permission === "granted") {
            var notification = new Notification("Hi there!");
          }
        });
      }
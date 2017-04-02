var app = angular.module('myApp', []);

app.controller('myCtrl', function($scope, $http, $sce, $window) {
  $scope.map;
  $scope.geocoder;
  $scope.markers = [];
  $scope.infoWindows = [];
  $scope.results;
  $scope.shortResults;
  $scope.directionsDisplay;
  $scope.directionsService;
  $scope.currentLocation = "";
  $scope.destination = "";
  $scope.interest = "";
  $scope.showFindings;

  var googleMapsAPI = "https://maps.googleapis.com/maps/api/js?key=AIzaSyAghhMHevtyJcyfHx-Gt4KJdwdDk08mWiM";
  var googleMapsResponse = $http.jsonp($sce.trustAsResourceUrl(googleMapsAPI), {jsonpCallbackParam: 'callback'})
    .then(
      function(response){
        $scope.initMap();
      },
      function(error){
        console.log("Google Map's error status: " + JSON.stringify(error.status));
      });

  $scope.initMap = function(){
    $scope.directionsDisplay = new google.maps.DirectionsRenderer;
    $scope.directionsService = new google.maps.DirectionsService;
    $scope.geocoder = new google.maps.Geocoder();
    $scope.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 8,
      center: {lat: 38.6270025, lng: -90.19940419999999}
    });
    $scope.directionsDisplay.setMap($scope.map);
    $scope.directionsDisplay.setPanel(document.getElementById('directions'));
    google.maps.event.addDomListener($window, "resize", function() {
      var center = $scope.map.getCenter();
      google.maps.event.trigger($scope.map, "resize");
      $scope.map.setCenter(center);
      if ($scope.markers.length > 0){
        var bounds = new google.maps.LatLngBounds();
        for (var i = 0; i < $scope.markers.length; i++){
          bounds.extend($scope.markers[i].getPosition());
        }
        $scope.map.fitBounds(bounds);
      }
    });
    $scope.getLocation();
  }

  $scope.getLocation = function(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function(position){
        var pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        $scope.geocoder.geocode({'location': pos}, function(results, status) {
          if (status === 'OK') {
            $scope.currentLocation = results[0].formatted_address;
            $scope.$digest();
          }
          else {
            alert('Geocoder failed due to: ' + status);
          }
        });
      }, function(){
        alert("The Geolocation service failed. Please enter your current location.");
      });
    }
    else{
      alert("Your browser doesn't support geolocation. Please enter your current location.");
    }
  }

  $scope.find = function(){
    if ($scope.interest === "" || $scope.destination === ""){
      alert("Please fill out fields in order to search. Example: I'm looking for FOOD near ST. LOUIS, MO.");
    }
    else{
      var link = "https://api.foursquare.com/v2/search/recommendations?v=20170307&m=foursquare&limit=25&client_id=4BJF1QQMJTGSSZ33EBOFOR0FX5N0WGHL1H2M4EKKCLVZO5FP&client_secret=00J50PFKINT4AZSKORDO4KOJMNSDCNMA0EVOBEVRE4PKATIA";
      var userInput = "&query=" + $scope.interest + "&near=" + $scope.destination;
      var url = link + userInput;
      var foursquareResponse = $http.jsonp($sce.trustAsResourceUrl(url), {jsonpCallbackParam: 'callback'})
      .then(
      function(response){
        $scope.clearDirections();
        $scope.deleteMarkers();
        if (JSON.stringify(response.data.response) === "{}"){
          $scope.showFindings = false;
          alert("Search couldn't find your area of interest: " + $scope.destination);
        }
        else if (JSON.stringify(response.data.response.group.totalResults) === "0"){
          $scope.showFindings = false;
          alert("Search couldn't find \"" + $scope.interest + "\" around " + $scope.destination);
        }
        else{
          $scope.showFindings = true;
          $scope.results = angular.fromJson(response.data);
          $scope.shortResults = $scope.results.response.group.results;
          var bounds = new google.maps.LatLngBounds();
          for(var i = 0; i < $scope.shortResults.length; i++){
            var marker = new google.maps.Marker({
              map: $scope.map,
              position: {lat: $scope.shortResults[i].venue.location.lat, lng: $scope.shortResults[i].venue.location.lng},
              index: i
            });
            var info = "<div><strong>" + (i+1).toString() + ". " + $scope.shortResults[i].venue.name + '</strong><br/>' + $scope.shortResults[i].venue.location.formattedAddress[0];
            var infowindow = new google.maps.InfoWindow({
              content: info
            });
            $scope.infoWindows.push(infowindow);
            marker.addListener('click', function() {
              $scope.closeInfoWindows();
              $scope.infoWindows[this.index].open($scope.map, this);
            });
            $scope.markers.push(marker);
            bounds.extend(marker.getPosition());
          }
          $scope.geocodeAddress(bounds);
        }
      },
      function(error){
        $scope.showFindings = false;
        alert("Server had problems returning your search results.");
      });
    }
  }

  $scope.geocodeAddress = function(bounds){
    $scope.geocoder.geocode({'address': $scope.destination}, function(results, status){
      if (status === 'OK'){
        $scope.map.setCenter($scope.results.response.context.currentLocation.feature.geometry.center);
        $scope.map.fitBounds(bounds);
      }
      else{
        alert('Unable to find destination for the following reason: ' + JSON.stringify(status));
      }
    });
  }

  $scope.calculateAndDisplayRoute = function(index){
    $scope.currentLocation = $scope.currentLocation.trim();
    if($scope.currentLocation !== ""){
      $scope.directionsService.route({
        origin: $scope.currentLocation,
        destination: {lat: $scope.shortResults[index].venue.location.lat, lng: $scope.shortResults[index].venue.location.lng},
        travelMode: 'DRIVING'
      }, function(response, status){
        if (status === 'OK'){
          $scope.showFindings = false;
          $scope.$digest(); //Makes ng-show work with $scope.showFindings
          $scope.deleteMarkers();
          $scope.directionsDisplay.setDirections(response);
          var responseData = angular.fromJson(response.routes[0].legs[0]);
          var bounds = new google.maps.LatLngBounds();
          var startMarker = new google.maps.Marker({
            position: {lat: responseData.start_location.lat(), lng: responseData.start_location.lng()}
          });
          var endMarker = new google.maps.Marker({
            position: {lat: responseData.end_location.lat(), lng: responseData.end_location.lng()}
          });
          $scope.markers.push(startMarker, endMarker);
        }
        else {
          alert("Directions request failed due to: " + status);
        }
      });
    }
    else{
      alert(" Please fill out current location. Example: 1200 Market St, St Louis, MO.");
    }
  }

  $scope.clearDirections = function(){
    $scope.directionsDisplay.set('directions',null);
  }

  $scope.deleteMarkers = function(){
    for (var i = 0; i < $scope.markers.length; i++){
      $scope.markers[i].setMap(null);
    }
    $scope.markers = [];
    $scope.infoWindows = [];
  }

  $scope.closeInfoWindows = function(){
    for (var i = 0; i < $scope.infoWindows.length; i++){
      $scope.infoWindows[i].setMap(null);
    }
  }

  $scope.zoomToMarker = function(index){
    $scope.map.setCenter($scope.markers[index].position);
    $scope.map.setZoom(17);
    $scope.closeInfoWindows();
    $scope.infoWindows[index].open($scope.map, $scope.markers[index]);
  }
});

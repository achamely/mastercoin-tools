var initialAmount = 0;
function AcceptOfferController($scope, $http) {
    $scope.transactionInformation;
 
    $scope.footer = "FOOTER";
    $scope.title = "TITLE";

    $scope.key = "";

    $scope.keyChange = function () {

        if ($scope.key != "") {
            $('#reSign').attr('disabled', false);
        }
        else {
            $('#reSign').attr('disabled', true);
        }
    };

    $scope.getSellofferData = function () {

        // parse tx from url parameters
        var myURLParams = BTCUtils.getQueryStringArgs();
        var file = 'tx/' + myURLParams['tx'] + '.json';

        // Make the http request and process the result

        $http.get(file, {}).success(function (data, status, headers, config) {
            $scope.transactionInformation = data[0];

            $scope.transactionInformation.formatted_amount = parseFloat($scope.transactionInformation.formatted_amount);
            initialAmount = $scope.transactionInformation.formatted_amount;

            $scope.transactionInformation.to_address = 11;
        });
      
    }

    $scope.comboBoxValueChange = function () {
        console.log($scope.transactionInformation);
    }

    $scope.AmountChanged = function () {
        $('#amountWarning').hide();
        if (initialAmount < $scope.transactionInformation.formatted_amount) {
            // Amount higher than offer - Should tell the user that 
            console.log("blue warning");
            $('#amountWarning').show();
        }
    }
}

$(document).ready(function myfunction() {

    //Combbox init
    BTNClientContext.Signing.initHistoryCombobox();
    $(".combobox").combobox();


    //disable btn at the beggining, because it needs to have a value in a privateKey
    $('#reSign').attr('disabled', true);


    $('#createRawTransaction').click(function () {
        $('#createRawTransactionLoader').show();

        BTNClientContext.Signing.GetRawTransaction();


        //Add address to history
        BTNClientContext.Signing.addAddressToHistory();

        $('#createRawTransactionLoader').hide();
    });

    $('#reSign').click(function () {

        $('#reSignLoader').show();

        BTNClientContext.Signing.ReSignTransaction();

        $('#reSignLoader').hide();
    });

    $('#send').click(function () {
        $('#sendLoader').show();

        BTNClientContext.Signing.SendTransaction();
        
        $('#sendLoader').hide();
    });

    $('#verifyButton').click(function () {
        $('#verifyMessage').hide();
        $('#verifyLoader').show();

        //If returned ok then add address to history
        if (BTNClientContext.Signing.Verify()) {
            BTNClientContext.Signing.addAddressToHistory();

            console.log('added to history');
        }
        else {
            console.log('not verified and not ok');
        }
        
        $('#verifyLoader').hide();
    });



    $("#rawJsonRadio").click(function () {

        console.log(BTNClientContext.Signing.Transaction);
        var converted = "";
        if ($('#RawRadioBtn').hasClass('active')) { //It raw has class active it means that the json state is selected now
            converted = BTNClientContext.Signing.ConvertRaw();
        }
        else { //the raw state is selected now
            converted = BTNClientContext.Signing.Transaction;
        }

        $('#transactionBBE').val(converted);
    });

});

//class for Context
BTNClientContext = new function () {
};
//class for Signing
BTNClientContext.Signing = new function () {
};

BTNClientContext.Signing.Transaction = "";

BTNClientContext.Signing.ConvertRaw = function () {

    var str = BTNClientContext.Signing.Transaction;
    str = str.replace(/[^0-9a-fA-f]/g, '');
  //  $('#transactionRaw').val(str);
    var bytes = Crypto.util.hexToBytes(str);
    var sendTx = BTNClientContext.Signing.deserialize(bytes);
    var text = BTNClientContext.toBBE(sendTx);

    return text;
    //$('#transactionBBE').val(text);
}



BTNClientContext.Signing.Verify = function () {
    console.log("verify function");
    var buyer = $("input.select.optional.form-control.form-control30px.combobox").val();

    var dataToSend = { 'buyer': buyer };

    var ok = true;
    $.post('/wallet/verifybuyer', dataToSend, function (data) {
        console.log('success');
        console.log(data);

        if (data.status == 'OK') {
            $('#verifyMessage').text('OK');
            $('#verifyMessage').addClass('greenText');


            $('#verifyMessage').show();

            return ok;
        }
        else {
            $('#verifyMessage').text('non valid');
            $('#verifyMessage').addClass('redText');

            ok = false;


            $('#verifyMessage').show();

            return ok;
        }
	// TODO This should be changed - Currently always fail as there is no server
    }).fail(function () { //Every time is failing right now because there is no server, so I am using that for testing the return of the server

        console.log('fail');
        //This should be changed, only for testing
        $('#verifyMessage').text('non valid');
        $('#verifyMessage').addClass('redText');


        //$('#verifyMessage').text('OK');
        //$('#verifyMessage').addClass('greenText');

        ok = false;

        $('#verifyMessage').show();

        return ok;
    });


  
};

BTNClientContext.Signing.SingSource = function () {
    var hashType = 1;

    //Source Script for signing
    var sourceScript = [];
    var sourceScriptString = $('#sourceScript').val().split(';');
    $.each(sourceScriptString, function (i, val) {
        sourceScript[i] = new BTNClientContext.parseScript(val);
        console.log(val);
        console.log($.toJSON(sourceScript[i]));
        console.log(BTNClientContext.dumpScript(sourceScript[i]));
    });

    //create transaction object from BBE JSON
    // var transactionBBE = $('#transactionBBE').val();
    var transactionBBE = BTNClientContext.Signing.ConvertRaw();
    var sendTx = BTNClientContext.fromBBE(transactionBBE);

    //signature section
    var eckey = BTNClientContext.GetEckey($('#privateKey').val()); //ECDSA
    console.log($('#privateKey').val());
    console.log(Crypto.util.bytesToHex(eckey.getPubKeyHash()));
    for (var i = 0; i < sendTx.ins.length; i++) { //for each input in the transaction -- sign it with the Key

        //console.log($.toJSON(sendTx));
        //console.log($.toJSON(sourceScript[i]));

        var hash = sendTx.hashTransactionForSignature(sourceScript[i], i, hashType); //Get hash of the transaction applying the soure script
        console.log(Crypto.util.bytesToHex(hash));

        var signature = eckey.sign(hash); //<---SIGN HERE
        signature.push(parseInt(hashType, 10)); //add white space
        var pubKey = eckey.getPub();			//public key

        //creating new in sript signature
        var script = new Bitcoin.Script();
        script.writeBytes(signature);
        script.writeBytes(pubKey);
        //write sript signature
        sendTx.ins[i].script = script;
    }

    return BTNClientContext.toBBE(sendTx);
};
//Should re sign transaction -- need to call all BC functions
BTNClientContext.Signing.ReSignTransaction = function () {
   var reSigned = BTNClientContext.Signing.SingSource();

    //show re-signed transaction
   $('#signedTransactionBBE').val(reSigned);

    //show hidden
    $('#reSignClickedForm').show();
};

BTNClientContext.Signing.SendTransaction = function () {

    var signedTransaction = $('#signedTransactionBBE').val();

    //Maybe I need to convert to object from json string???

    var dataToSend = { 'signedTransaction': signedTransaction };
    console.log(dataToSend);

    // Ajax call to /wallet/accept
    $.post('/wallet/acceptsigned', dataToSend, function (data) {
        console.log('success');
        console.log(data);


    }).fail(function () {

        // TODO  This should be changed - Currently always fail as there is no server

    });
};

BTNClientContext.Signing.GetRawTransaction = function () {


    var myURLParams = BTCUtils.getQueryStringArgs();
    var buyer = myURLParams['tx'];


    var amount = $('#amount').val();
    var tx = $('#seller').val();

    var dataToSend = { 'buyer': buyer, 'amount': amount, 'tx': tx };
    console.log(dataToSend);

    // Ajax call to /wallet/accept
    $.post('/wallet/accept', dataToSend, function (data) {
        console.log('success');
        console.log(data);

        BTNClientContext.Signing.GetRawTransactionResponse(data);

    }).fail(function () {

        // TODO This should be changed - Currently always fail as there is no server

        console.log('fail');
        var testResponse = {
            'sourceScript': 'OP_DUP OP_HASH160 4ae99c09a1944717ed4ebce399d44538023809c1 OP_EQUALVERIFY OP_CHECKSIG',
            'transaction': '01000000017a06ea98cd40ba2e3288262b28638cec5337c1456aaf5eedc8e9e5a20f062bdf000000008a4730440220569b1ad609dcad5f17fd372533a51472771c5ea9e4aca6654d1c864e59b083e902207a8e2dedb07cee1fce92562fd3c072a0e9152e0d69b9ab436dd70f4662c487f4014104e0ba531dc5d2ad13e2178196ade1a23989088cfbeddc7886528412087f4bff2ebc19ce739f25a63056b6026a269987fcf5383131440501b583bab70a7254b09effffffff01b02e052a010000001976a9142dbde30815faee5bf221d6688ebad7e12f7b2b1a88ac00000000'
        };
        BTNClientContext.Signing.GetRawTransactionResponse(testResponse);

    });
};

BTNClientContext.Signing.GetRawTransactionResponse = function (data) {


    BTNClientContext.Signing.Transaction = data.transaction;

    //Init fields values
    //data should have fields sourceScript and transaction
    $('#sourceScript').val(data.sourceScript);
    $('#transactionBBE').val(data.transaction);

    //Showing the fields
    $('#createRawResponseForm').show();

};



// HISTORY of Buyer address or public key

BTNClientContext.Signing.supportsStorage = function () {
    try {
        return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
        return false;
    }
};

BTNClientContext.Signing.initHistoryCombobox = function () {
    if (BTNClientContext.Signing.supportsStorage()) {

        console.log(localStorage["Addresses"]);
        if (localStorage["Addresses"]) {

            var addresses = localStorage["Addresses"];
            var history = JSON.parse(addresses);

            console.log(history);

            // if there is something in history add to combobox
            var showValuesInCombobox = history.reverse();
            $.each(showValuesInCombobox, function (key, value) {

                console.log(key);
                console.log(value);

                $('#buyerAddressOrPublicKey')
                    .append($("<option></option>")
                    .attr("value", value)
                    .text(value));

                //.attr("value", value.address)
                //    .text(value.address));
            });
        }
    }
    else {
        //Doesn't support storage, do nothing
    }
};

BTNClientContext.Signing.addAddressToHistory = function () {
    if (BTNClientContext.Signing.supportsStorage()) {

        var address = $("input.select.optional.form-control.form-control30px.combobox").val();
        var history;
        if (localStorage["Addresses"]) {
            history = JSON.parse(localStorage["Addresses"]);
            if (history.length > 9) {
                history.shift();
            }
            var addr = { 'address': address };

            // Check if the addr is in the array already and if it is delete it
           // var index = history.indexOf(addr);
            var index = history.indexOf(address);
            if (index > -1) {
                history.splice(index, 1);
            }

            //add new address to array
            //  history.push(addr);
            history.push(address);

            localStorage["Addresses"] = JSON.stringify(history);
        }
        else { // If the localStorage["Addresses"] doesn't exists
         //   var addr = { 'address': address };
            var que = [];
            // que.push(addr);
            que.push(address);
            localStorage["Addresses"] = JSON.stringify(que);
        }

       // console.log(localStorage["Addresses"]);
    }
};
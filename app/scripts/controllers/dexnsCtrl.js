'use strict';
/* 0 -> nothing
 *  1 -> user
 *  2 -> token
 *  3 -> contract
 *  4 -> update Name
 *  5 -> access Name content
 *  6 -> step 2 register Name
 *  7 -> confirmation
 */
const statusCodes = {
    nothing: 0,
    'user': 1,
    'token': 2,
    'contract': 3,
    'update Name': 4,
    'access Name content': 5,
    'step 2 register Name': 6,
    'confirmation': 7,
};


const dexnsCtrl = function (
    $scope,
    $sce,
    $rootScope,
    walletService,
    backgroundNodeService,
    dexnsService
) {

    $scope.etherUnits = etherUnits;

    $scope.dexnsService = dexnsService;
    walletService.wallet = null;

    $scope.contract = dexnsService.contract;

    $scope.walletService = walletService;


    if (nodes.nodeList[globalFuncs.getCurNode()].type !== 'ETC') {

        $rootScope.$broadcast('ChangeNode', globalFuncs.networks['ETC'] || 0);

    }
    $scope.networks = globalFuncs.networks;


    $scope.dexnsConfirmModalModal = new Modal(document.getElementById('dexnsConfirmModal'));
    $scope.sendTransactionContractModal = new Modal(document.getElementById('sendTransactionContract'));


    // TODO
    $scope.$watch(function () {
        if (walletService.wallet == null) return null;
        return walletService.wallet.getAddressString();
    }, function () {
        if (walletService.wallet == null) return;
        $scope.wallet = walletService.wallet;
        $scope.wd = true;
        $scope.wallet.setBalance();
        $scope.wallet.setTokens();
    });


    $scope.handleRegisterAndUpdateName = function (event) {

        event.preventDefault();

        if (!walletUnlocked()) return false;

        const {tokenName, owner, destination, abi, link, sourceCode, info, tokenNetwork, hideOwner, assign} = $scope.input;


        // fixme: hideOwner, owner

        const _metadata = dexnsService.metaData($scope.input);

        const _owner = walletService.wallet.getAddressString();

        const _destination = _owner;

        const _hideOwner = true;

        const _assign = false;


        $scope.tx = {
            inputs: [tokenName, _owner, _destination, _metadata, _hideOwner, _assign],
            value: dexnsService.contract.namePrice,
            unit: 'wei',
            from: _owner,
        };

        const wallet = walletService.wallet;

        dexnsService.contract.genTxContract(
            'registerAndUpdateName',
            wallet,
            $scope.tx,
        ).then(openModal)

    };


    $scope.getOwningTime = function () {

        dexnsService.contract.call('owningTime');

    }

    $scope.call = function (_function) {

        dexnsService.contract.call(_function.name, {inputs: _function.inputs.map(i => i.value)}).then(() => {

            $scope.$apply();
        })
    };

    /*


        generate tx to contract

        open modal to confirm
     */

    $scope.genTxOpenModal = function (_function) {

        if (!walletUnlocked()) {

            return false;
        }

        let value = 0;

        if (['registerName', 'registerAndUpDateName'].includes(_function.name)) {

            value = dexnsService.contract.namePrice;

        }

        $scope._function = _function;
        dexnsService.contract.genTxContract(_function.name,
            walletService.wallet,
            {
                inputs: _function.inputs.map(i => i.value),
                from: walletService.wallet.getAddressString(),
                value,
                unit: 'wei',
            }).then(openModal)
    };


    function openModal(signedTx) {


        $scope.tx = signedTx;
        $scope.sendTransactionContractModal.open();

    }

    /*

        send the tx to contract after user confirms
     */

    $scope.sendTxContract = function () {

        dexnsService.contract.sendTx($scope.tx).finally(() => {

            $scope.sendTransactionContractModal.close();
        });
    };


    $scope.openRegisterName = function () {
        $scope.dexns_status = statusCodes.user; // 1 -> user
    }

    $scope.openRegisterToken = function () {

        $scope.dexns_status = statusCodes.token;
    }

    $scope.checkDexNSName = function () {


        dexnsService.contract.call('endtimeOf', {inputs: [$scope.DexNSName]})
            .then(data => {

                const _time = new Date().getTime();
                const _renderedTime = new BigNumber(_time);


                if (ajaxReq.type !== "ETC") {
                    $scope.notifier.danger("DexNS accepts only $ETC for gas payments! You should switch to ETC node first to register your name.");
                }
                if (_renderedTime.gt(data * 1000)) {
                    $scope.dexns_status = statusCodes['step 2 register Name'];
                    $scope.notifier.info("This name is available for registration.");
                } else {
                    uiFuncs.notifier.danger("This name is already registered! You should try to register another name.");
                }

            })

    }


    function walletUnlocked() {

        if ($scope.wallet === undefined) {
            $scope.notifier.danger("Unlock your wallet first!");

            return false;
        }

        return true;
    }

    $scope.registerDexNSName = function () {

        if (walletUnlocked()) {

            $scope.dexns_status = statusCodes.confirmation;

            Object.assign($scope.tx, {
                value: dexnsService.contract.namePrice,
                unit: 'wei',
                to: dexnsService.contract.address
            });

            $scope.dexnsConfirmModalModal.open();
        }
    }

    $scope.viewContracts = [
        'registerName',
        'namePrice',
        'endtimeOf',
        'extend_Name_Binding_Time',
        'unassignName',
        'updateName',
        'appendNameMetadata',
        'updateName',
        'hideNameOwner',
        'assignName',
        'changeNameOwner',
    ];

    $scope.visibleFuncList = function () {


        return dexnsService.contract.abi.filter(i => {

            return $scope.viewContracts.includes(i.name);
        }).map(i => {

            if (i.type !== 'view') {

                i.sortBy = 10;
            } else {

                i.sortBy = 1;
            }

            return i;
        }).sort((a, b) => b.sortBy - a.sortBy);
    };


    $scope._registerName = function () {

        const tx = {
            value: dexnsService.contract.namePrice,
            unit: 'wei',
            from: walletService.wallet.getAddressString(),
            inputs: [$scope.DexNSName],
        };

        return uiFuncs.genTxContract('registerName', dexnsService.contract, walletService.wallet, tx)
            .then(_tx => {


                $scope.tx = _tx;
                return uiFuncs.sendTxContract(dexnsService.contract, $scope.tx);


            })
            .finally(() => {

                $scope.dexnsConfirmModalModal.close();

            })
    };


    $scope.toTimestamp = function (date) {
        var dateSplitted = date.split('-'); // date must be in DD-MM-YYYY format
        var formattedDate = dateSplitted[1] + '/' + dateSplitted[0] + '/' + dateSplitted[2];
        return new Date(formattedDate).getTime();
    };

    function main() {

        init();

        Promise.all([
            dexnsService.contract.call('namePrice'),
            dexnsService.contract.call('owningTime'),
        ]);


    }

    const values = Object.values(nodes.nodeTypes);

    function init() {


        $scope.noder = values;


        Object.assign($scope, {
            noder: values,
            dexns_status: statusCodes.nothing, //0,
            // user input of name to register
            DexNSName: '',
            input: {
                abi: '',
                link: '',
                sourceCode: '',
                info: '',
                tokenName: '',
                tokenNetwork: ajaxReq.type,
                owner: '',
                destination: '',
                hideOwner: false,
                assign: false,
            },
            hideEnsInfoPanel: false,
            tx: {
                gasLimit: '200000',
                data: '',
                to: '',
                unit: "ether",
                value: 0,
                gasPrice: ''
            },
            sendTxStatus: "",
            _function: null,
        });


    }

    $scope.init = init;

    main();

}

module.exports = dexnsCtrl;

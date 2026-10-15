// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { CrowdFund } from "../contracts/CrowdFund.sol";
import { FundingRecipient } from "../contracts/FundingRecipient.sol";
import { AggregatorV3Interface } from "../contracts/interfaces/AggregatorV3Interface.sol";

contract CrowdFundPriceTest is Test {
    CrowdFund internal crowdFund;
    address internal feed;

    function setUp() public {
        vm.warp(1_800_000_000);
        crowdFund = new CrowdFund(address(new FundingRecipient()));
        feed = address(crowdFund.PRICE_FEED());
        mockPrice(2500e8, block.timestamp, 8);
    }

    function mockPrice(int256 answer, uint256 updatedAt, uint8 decimals) internal {
        vm.mockCall(feed, abi.encodeCall(AggregatorV3Interface.decimals, ()), abi.encode(decimals));
        vm.mockCall(
            feed,
            abi.encodeCall(AggregatorV3Interface.latestRoundData, ()),
            abi.encode(uint80(1), answer, updatedAt, updatedAt, uint80(1))
        );
    }

    function test_PriceNormalizedTo18Decimals() public view {
        (uint256 price, uint256 updatedAt) = crowdFund.getEthUsdPrice();
        assertEq(price, 2500e18);
        assertEq(updatedAt, block.timestamp);
    }

    function test_UsdValuesForContributionBoundaries() public view {
        assertEq(crowdFund.getUsdValue(0.01 ether), 25e18);
        assertEq(crowdFund.getUsdValue(0.1 ether), 250e18);
        assertEq(crowdFund.getUsdValue(1000 ether), 2_500_000e18);
        assertEq(crowdFund.getUsdValue(0), 0);
    }

    function test_HandlesDifferentFeedPrecision() public {
        mockPrice(2500e18, block.timestamp, 18);
        (uint256 price,) = crowdFund.getEthUsdPrice();
        assertEq(price, 2500e18);
    }

    function test_RejectsNonPositivePrices() public {
        mockPrice(0, block.timestamp, 8);
        vm.expectRevert(CrowdFund.InvalidOraclePrice.selector);
        crowdFund.getEthUsdPrice();
        mockPrice(-1, block.timestamp, 8);
        vm.expectRevert(CrowdFund.InvalidOraclePrice.selector);
        crowdFund.getEthUsdPrice();
    }

    function test_RejectsIncompleteAndFutureTimestamps() public {
        mockPrice(2500e8, 0, 8);
        vm.expectRevert(CrowdFund.InvalidOraclePrice.selector);
        crowdFund.getEthUsdPrice();
        mockPrice(2500e8, block.timestamp + 1, 8);
        vm.expectRevert(CrowdFund.InvalidOraclePrice.selector);
        crowdFund.getEthUsdPrice();
    }

    function test_RejectsStalePriceAndAcceptsAgeBoundary() public {
        uint256 oldest = block.timestamp - crowdFund.MAX_PRICE_AGE();
        mockPrice(2500e8, oldest, 8);
        (uint256 price,) = crowdFund.getEthUsdPrice();
        assertEq(price, 2500e18);
        mockPrice(2500e8, oldest - 1, 8);
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.StaleOraclePrice.selector, oldest - 1));
        crowdFund.getEthUsdPrice();
    }

    function test_RejectsUnsupportedPrecision() public {
        mockPrice(2500e8, block.timestamp, 19);
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.UnsupportedOracleDecimals.selector, uint8(19)));
        crowdFund.getEthUsdPrice();
    }

    function test_OracleFailureDoesNotBlockRefunds() public {
        vm.deal(address(this), 1 ether);
        crowdFund.contribute{value: 0.1 ether}();
        vm.warp(crowdFund.deadline() + 1);
        crowdFund.execute();
        mockPrice(0, block.timestamp, 8);
        uint256 balanceBefore = address(this).balance;
        crowdFund.withdraw();
        assertEq(address(this).balance, balanceBefore + 0.1 ether);
    }

    receive() external payable { }
}

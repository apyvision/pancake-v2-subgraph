/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from './helpers'

const WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
const BUSD_WBNB_PAIR = '0x1b96b92314c44b159149f7e0303511fb2fc4774f' // created block 589414
const DAI_WBNB_PAIR = '0xf3010261b58b2874639ca2e860e9005e3be5de0b'  // created block 481116
const USDT_WBNB_PAIR = '0x20bcc3b8a0091ddac2d0bc30f68e6cbb97de59cd' // created block 648115

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtPair = Pair.load(USDT_WBNB_PAIR) // usdt is token0
  let busdPair = Pair.load(BUSD_WBNB_PAIR) // busd is token1
  let daiPair = Pair.load(DAI_WBNB_PAIR)   // dai is token0

  // all 3 have been created
  if (daiPair !== null && busdPair !== null && usdtPair !== null) {
    let totalLiquidityBNB = daiPair.reserve1.plus(busdPair.reserve0).plus(usdtPair.reserve1)
    let daiWeight = daiPair.reserve1.div(totalLiquidityBNB)
    let busdWeight = busdPair.reserve0.div(totalLiquidityBNB)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB)
    return daiPair.token0Price
      .times(daiWeight)
      .plus(busdPair.token1Price.times(busdWeight))
      .plus(usdtPair.token0Price.times(usdtWeight))
    // busd and usdt have been created
  } else if (busdPair !== null && usdtPair !== null) {
    let totalLiquidityBNB = busdPair.reserve0.plus(usdtPair.reserve1)
    let busdWeight = busdPair.reserve0.div(totalLiquidityBNB)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB)
    return busdPair.token1Price.times(busdWeight).plus(usdtPair.token0Price.times(usdtWeight))
    // usdt is the only pair so far
  } else if (busdPair !== null) {
    return busdPair.token1Price
  } else if (usdtPair !== null) {
    return usdtPair.token0Price
  } else {
    return ZERO_BD
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
  '0x55d398326f99059ff775485246999027b3197955', // USDT
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
  '0x23396cf899ca06c4472205fc903bdb4de249d6fc', // UST
  '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI
  '0x4bd17003473389a42daf6a0a729f6fdb328bbbd7', // VAI
  '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', // BTCB
  '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // WETH
  '0x250632378e573c6be1ac2f97fcdf00515d0aa91b', // BETH
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('400000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('10')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WBNB_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]))
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}


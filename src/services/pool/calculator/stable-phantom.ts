import Calculator from './calculator.sevice';
import { PiOptions } from './calculator.sevice';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { parseUnits, formatUnits } from '@ethersproject/units';
import { phantomStableBPTForTokensZeroPriceImpact as _bptForTokensZeroPriceImpact } from '@balancer-labs/sor2';
import { bnum } from '@/lib/utils';
import OldBigNumber from 'bignumber.js';

export default class StablePhantom {
  calc: Calculator;
  AMP_PRECISION = bnum(1000);

  constructor(calculator) {
    this.calc = calculator;
  }

  public priceImpact(tokenAmounts: string[], opts: PiOptions): OldBigNumber {
    if (!opts.queryBPT) return bnum(100);

    let bptAmount: OldBigNumber | BigNumberish;
    let bptZeroPriceImpact: OldBigNumber;

    if (this.calc.action === 'join') {
      bptAmount = bnum(opts.queryBPT);
      if (bptAmount.isLessThan(0)) return bnum(0);
      bptZeroPriceImpact = this.bptForTokensZeroPriceImpact(tokenAmounts);

      return bnum(1).minus(bptAmount.div(bptZeroPriceImpact));
    } else {
      // TODO - withdrawl price impact calc
      return new OldBigNumber(100);
    }
  }

  /**
   * PRIVATE FUNCTIONS
   */
  private bptForTokensZeroPriceImpact(tokenAmounts: string[]): OldBigNumber {
    const amp = bnum(this.calc.pool.value.onchain.amp?.toString() || '0');
    const ampAdjusted = BigNumber.from(this.adjustAmp(amp).toString());
    const denormAmounts = this.calc.denormAmounts(
      tokenAmounts,
      this.calc.poolTokenDecimals
    );

    const bptZeroImpact = _bptForTokensZeroPriceImpact(
      this.scaledBalances,
      this.calc.poolTokenDecimals,
      denormAmounts,
      this.calc.poolTotalSupply,
      ampAdjusted,
      this.calc.poolSwapFee,
      this.priceRates
    );

    console.log('bptZeroImpact', bptZeroImpact.toString());

    return bnum(bptZeroImpact.toString());
  }

  private get scaledBalances(): BigNumber[] {
    return this.calc.poolTokenBalances.map((balance, i) => {
      const normalizedBalance = formatUnits(
        balance,
        this.calc.poolTokenDecimals[i]
      );
      const scaledBalance = this.scaleInput(
        normalizedBalance,
        this.calc.pool.value.tokens[i].priceRate
      );
      return scaledBalance;
    });
  }

  private scaleInput(
    normalizedAmount: string,
    priceRate: string | null = null
  ): BigNumber {
    if (priceRate === null) priceRate = '1';

    const denormAmount = bnum(parseUnits(normalizedAmount, 18).toString())
      .times(priceRate)
      .toFixed(0, OldBigNumber.ROUND_UP);

    return BigNumber.from(denormAmount);
  }

  // Solidity maths uses precison method for amp that must be replicated
  private adjustAmp(amp: OldBigNumber): OldBigNumber {
    return amp.times(this.AMP_PRECISION);
  }

  private get priceRates(): BigNumberish[] {
    const linearPools = Object.values(
      this.calc.pool.value.onchain.linearPools || {}
    );
    if (!linearPools) return [];
    return linearPools.map(pool => parseUnits(pool.priceRate, 18));
  }
}

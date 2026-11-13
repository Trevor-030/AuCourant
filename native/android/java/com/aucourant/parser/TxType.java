package com.aucourant.parser;

/** What kind of MoMo message this is, and which way the money moved. */
public enum TxType {
    RECEIVED(Direction.IN),
    CASH_IN(Direction.IN),
    REVERSAL(Direction.IN),
    SENT(Direction.OUT),
    MERCHANT(Direction.OUT),
    BILL(Direction.OUT),
    CASH_OUT(Direction.OUT),
    AIRTIME(Direction.OUT),
    /** No parser matched. Kept with its raw text for the "Not read" list, never dropped. */
    UNREAD(Direction.NONE);

    public enum Direction { IN, OUT, NONE }

    public final Direction direction;

    TxType(Direction direction) {
        this.direction = direction;
    }
}

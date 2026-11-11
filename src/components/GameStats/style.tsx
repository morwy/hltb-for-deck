export const HLTB_BAR_CSS = `

#hltb-for-deck{
    position: relative;
}

.hltb-info {
    background: var(--hltb-bar-bg, rgb(var(--hltb-bar-rgb, 14 20 27) / var(--hltb-bar-alpha, 0.25)));
    position: relative;
    border-bottom: var(--hltb-border-width, 2px) solid var(--hltb-border-color, rgba(61,68,80,.54));
    padding-top: var(--hltb-pad-y, 5px);
    padding-bottom: var(--hltb-pad-y, 5px);
    color: var(--hltb-text-color, inherit);
    text-shadow: var(--hltb-text-shadow, none);
    border-radius: var(--hltb-radius, 0);
}

/* Keep the "Clean" layouts at 50% opacity unless the user overrides it. */
.hltb-info-clean-default,
.hltb-info-clean {
    --hltb-bar-alpha: 0.5;
}

.hltb-info-clean-default {
    /* Keep room for Steam's button when the stats text is reduced. */
    --hltb-clean-default-height: max(40px, calc(var(--hltb-bar-height, 40px) * var(--hltb-text-scale, 1)));
    position: absolute;
    border: 0;
    border-bottom: var(--hltb-border-width, 0) solid var(--hltb-border-color, rgba(61,68,80,.54));
    padding-top: 0px;
    padding-bottom: 0px;
    top: calc(0px - var(--hltb-clean-default-height));
    height: var(--hltb-clean-default-height);
    width: 100%;
}

.hltb-info-absolute {
    position: absolute;
    display: none;
}

.hltb-info-clean {
    position: absolute;
    top: var(--hltb-clean-top, -55vh);
    right: var(--hltb-clean-inset, 2.8vw);
    width: fit-content;
    height: fit-content;
    border: 0;
    border-bottom: var(--hltb-border-width, 0) solid var(--hltb-border-color, rgba(61,68,80,.54));
}

.hltb-info-clean-left {
    right: 0px;
    left: var(--hltb-clean-inset, 2.8vw);
}

.hltb-info ul {
    list-style: none;
    padding: var(--hltb-pad-y, 5px) var(--hltb-pad-x, 35px);
    margin: 0px;
    display: flex;
    flex: 0 1 auto;    
}

.hltb-info-clean ul {
    display: block;
    flex-direction: column;
    gap: 10px;
}

.hltb-info ul li {
    text-align: center;
}

.hltb-info p {
    margin: 0;
}

.hltb-gametime {
    font-size: calc(var(--hltb-stat-size, 16px) * var(--hltb-text-scale, 1));
    font-weight: bold;
}

.hltb-label {
    text-transform: uppercase;
    font-size: calc(var(--hltb-label-size, 10px) * var(--hltb-text-scale, 1));
}
.hltb-details-item {
    align-self: center;
}

.hltb-info .hltb-details-container {
    background: transparent;
    padding: 0;
    margin: 0;
    gap: 0;
    justify-content: center;
}
`;

export default <style>{HLTB_BAR_CSS}</style>;

// Extra rules for the store page box. The store page doesn't inherit Steam's
// UI font or text color.
export const STORE_BAR_CSS = `
.hltb-store {
    font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
    color: #dcdedf;
    line-height: normal;
    text-align: left;
}

.hltb-store .hltb-info {
    border-bottom: 0;
}

.hltb-store .hltb-info ul {
    flex-wrap: nowrap;
    justify-content: space-evenly;
    gap: 16px;
}

.hltb-store .hltb-info li {
    flex: 0 0 auto;
    white-space: nowrap;
}

/* Steam's button classes don't exist in the store page, so this copies the
   look of the library's Details button. */
.hltb-store .hltb-details-btn {
    background: rgb(61, 68, 80);
    color: #ffffff;
    border: 0;
    border-radius: 5px;
    padding: 6px 14px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    line-height: normal;
}

.hltb-store .hltb-details-btn:focus,
.hltb-store .hltb-details-btn:hover {
    background: #ffffff;
    color: #000000;
    outline: none;
}
`;

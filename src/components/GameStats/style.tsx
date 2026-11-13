import {
    appDetailsClasses,
    basicAppDetailsSectionStylerClasses,
} from '@decky/ui';

export function joinedBlurStyle(height: string, paddingTop: string) {
    const container = `.${appDetailsClasses.InnerContainer}:has(> #hltb-for-deck.hltb-joined-blur)`;
    const playSection = `.${basicAppDetailsSectionStylerClasses.PlaySection}`;

    return (
        <style>
            {`
#hltb-for-deck.hltb-joined-blur {
    z-index: 2;
}

#hltb-for-deck.hltb-joined-blur > .hltb-info-clean-default {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: transparent !important;
}

#hltb-for-deck.hltb-joined-blur > .hltb-info-clean-default > ul {
    background: transparent !important;
    height: 100%;
    box-sizing: border-box;
}

${container} :has(> ${playSection}) {
    margin-top: calc(0px - ${height});
    padding-top: ${height};
}

${container} ${playSection} {
    margin-top: calc(0px - ${height});
    padding-top: calc(${paddingTop} + ${height});
}
`}
        </style>
    );
}

export const HLTB_BAR_CSS = `

#hltb-for-deck{
    position: relative;
}

#hltb-for-deck.hltb-blur {
    transform-style: preserve-3d;
}

#hltb-for-deck.hltb-blur > .hltb-info {
    backdrop-filter: blur(8px);
}

.hltb-info {
    background: var(--hltb-bar-bg, rgb(var(--hltb-bar-rgb, 14 20 27) / var(--hltb-bar-alpha, 0.25)));
    position: relative;
    border-bottom: var(--hltb-border-width, 2px) solid var(--hltb-border-color, rgba(61,68,80,.54));
    color: var(--hltb-text-color, inherit);
    text-shadow: var(--hltb-text-shadow, none);
    border-radius: var(--hltb-radius, 0);
}

.hltb-info-clean-default {
    --hltb-clean-default-height: max(57px, calc(var(--hltb-bar-height, 57px) * var(--hltb-text-scale, 1)));
    position: absolute;
    border: 0;
    border-bottom: var(--hltb-border-width, 0) solid var(--hltb-border-color, rgba(61,68,80,.54));
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
    padding: var(--hltb-pad-y, 10px) var(--hltb-pad-x, 2.8vw);
    margin: 0px;
    display: flex;
    flex: 0 1 auto;    
}

.hltb-info-clean-default ul,
.hltb-info-clean ul {
    background: rgba(14, 20, 27, .33);
    border-radius: inherit;
}

.hltb-info-clean ul {
    background: rgba(14, 20, 27, var(--hltb-content-alpha, .33));
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

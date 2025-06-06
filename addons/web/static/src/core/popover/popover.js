/** @odoo-module **/

import { Component, onWillDestroy, useExternalListener, useRef, useSubEnv } from "@odoo/owl";
import { useForwardRefToParent } from "@web/core/utils/hooks";
import { usePosition } from "@web/core/position/position_hook";
import { useActiveElement } from "@web/core/ui/ui_service";
import { useHotkey } from "@web/core/hotkeys/hotkey_hook";

export const POPOVER_SYMBOL = Symbol("popover");

export class Popover extends Component {
    static template = "web.Popover";
    static defaultProps = {
        position: "bottom",
        class: "",
        fixedPosition: false,
        arrow: true,
        animation: true,
        componentProps: {},
        closeOnClickAway: () => true,
    };
    static props = {
        component: { type: Function },
        componentProps: { type: Object, optional: true },
        ref: {
            type: Function,
            optional: true,
        },
        class: {
            optional: true,
            type: String,
        },
        position: {
            type: String,
            validate: (p) => {
                const [d, v = "middle"] = p.split("-");
                return (
                    ["top", "bottom", "left", "right"].includes(d) &&
                    ["start", "middle", "end", "fit"].includes(v)
                );
            },
            optional: true,
        },
        onPositioned: {
            type: Function,
            optional: true,
        },
        fixedPosition: {
            type: Boolean,
            optional: true,
        },
        arrow: {
            type: Boolean,
            optional: true,
        },
        animation: {
            type: Boolean,
            optional: true,
        },
        target: {
            validate: (target) => {
                // target may be inside an iframe, so get the Element constructor
                // to test against from its owner document's default view
                const Element = target?.ownerDocument?.defaultView?.Element;
                return (
                    (Boolean(Element) &&
                        (target instanceof Element || target instanceof window.Element)) ||
                    (typeof target === "object" && target?.constructor?.name?.endsWith("Element"))
                );
            },
        },
        slots: {
            type: Object,
            optional: true,
            shape: {
                default: { optional: true },
            },
        },
        close: {
            type: Function,
            optional: true,
        },
        closeOnClickAway: {
            type: Function,
            optional: true,
        },
        subPopovers: {
            optional: true,
        },
    };

    static animationTime = 200;
    setup() {
        useActiveElement("ref");
        useForwardRefToParent("ref");
        this.popoverRef = useRef("ref");
        this.shouldAnimate = this.props.animation;

        this.position = usePosition("ref", () => this.props.target, {
            onPositioned: (el, solution) => {
                (this.props.onPositioned || this.onPositioned.bind(this))(el, solution);
                if (this.props.fixedPosition) {
                    // Prevent further positioning updates if fixed position is wanted
                    this.position.lock();
                }
            },
            position: this.props.position,
        });

        this.props.subPopovers?.add(this);
        this.subPopovers = new Set();
        useSubEnv({ [POPOVER_SYMBOL]: this.subPopovers });

        if (this.props.target.isConnected) {
            useExternalListener(window, "pointerdown", this.onClickAway, { capture: true });
            useHotkey("escape", () => this.props.close());
            const targetObserver = new MutationObserver(this.onTargetMutate.bind(this));
            targetObserver.observe(this.props.target.parentElement, { childList: true });
            onWillDestroy(() => {
                targetObserver.disconnect();
                this.props.subPopovers?.delete(this);
            });
        } else {
            this.props.close();
        }
    }

    isInside(target) {
        if (this.props.target.contains(target) || this.popoverRef.el.contains(target)) {
            return true;
        }
        return [...this.subPopovers].some((p) => p.isInside(target));
    }

    onClickAway(ev) {
        const target = ev.composedPath()[0];
        if (this.props.closeOnClickAway(target) && !this.isInside(target)) {
            this.props.close();
        }
    }

    onTargetMutate() {
        if (!this.props.target.isConnected) {
            this.props.close();
        }
    }

    onPositioned(el, { direction, variant }) {
        const position = `${direction[0]}${variant[0]}`;

        // reset all popover classes
        const directionMap = {
            top: "top",
            bottom: "bottom",
            left: "start",
            right: "end",
        };
        el.classList = [
            "o_popover popover mw-100",
            `bs-popover-${directionMap[direction]}`,
            `o-popover-${direction}`,
            `o-popover--${position}`,
        ].join(" ");
        if (this.props.class) {
            el.classList.add(...this.props.class.split(" "));
        }

        // reset all arrow classes
        if (this.props.arrow) {
            const arrowEl = el.querySelector(":scope > .popover-arrow");
            arrowEl.className = "popover-arrow";
            switch (position) {
                case "tm": // top-middle
                case "bm": // bottom-middle
                case "tf": // top-fit
                case "bf": // bottom-fit
                    arrowEl.classList.add("start-0", "end-0", "mx-auto");
                    break;
                case "lm": // left-middle
                case "rm": // right-middle
                case "lf": // left-fit
                case "rf": // right-fit
                    arrowEl.classList.add("top-0", "bottom-0", "my-auto");
                    break;
                case "ts": // top-start
                case "bs": // bottom-start
                    arrowEl.classList.add("end-auto");
                    break;
                case "te": // top-end
                case "be": // bottom-end
                    arrowEl.classList.add("start-auto");
                    break;
                case "ls": // left-start
                case "rs": // right-start
                    arrowEl.classList.add("bottom-auto");
                    break;
                case "le": // left-end
                case "re": // right-end
                    arrowEl.classList.add("top-auto");
                    break;
            }
        }

        // opening animation
        if (this.shouldAnimate) {
            this.shouldAnimate = false; // animate only once
            const transform = {
                top: ["translateY(-5%)", "translateY(0)"],
                right: ["translateX(5%)", "translateX(0)"],
                bottom: ["translateY(5%)", "translateY(0)"],
                left: ["translateX(-5%)", "translateX(0)"],
            }[direction];
            this.position.lock();
            const animation = el.animate(
                { opacity: [0, 1], transform },
                this.constructor.animationTime
            );
            animation.finished.then(this.position.unlock);
        }
    }
}

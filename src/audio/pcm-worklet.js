class PcmCollector extends AudioWorkletProcessor {
    constructor() {
        super();
        this.block = new Float32Array(sampleRate);
        this.filled = 0;
    }

    process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (!channel) {
            return true;
        }
        for (let index = 0; index < channel.length; index += 1) {
            this.block[this.filled] = channel[index];
            this.filled += 1;
            if (this.filled === this.block.length) {
                this.port.postMessage(this.block.slice(0));
                this.filled = 0;
            }
        }
        return true;
    }
}

registerProcessor('pcm-collector', PcmCollector);

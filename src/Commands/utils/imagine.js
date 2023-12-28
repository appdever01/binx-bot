const axios = require('axios');

module.exports = {
    name: 'imagine',
    aliases: ['img'],
    category: 'utils',
    exp: 7,
    description: 'Generates an image based on user-defined prompt',

    async execute(client, flag, arg, M) {
        if (!arg) return M.reply('Sorry, you did not provide any imagination prompt!');
        
        const prompt = encodeURIComponent(arg);
        const apiUrl = `https://timeless.cyclic.app/api/image/imagine?prompt=${prompt}`; 
        
        try {
            const response = await axios.get(apiUrl);
            const imageData = response.data.data[0]; // Assuming you want to use the first image in the array
            
            if (imageData) {
                const imageUrl = imageData.imageUrl;
                
                await client.sendMessage(M.from, {
                    image: {
                        url: imageUrl
                    },
                    caption: 'Imagination brought to life by Binx! 😌💙'
                });
            } else {
                return M.reply('Could not generate image based on the provided prompt.');
            }
        } catch (error) {
            console.error('Error fetching image:', error);
            return M.reply('Could not generate image based on the provided prompt.');
        }
    }
};
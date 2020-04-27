import finder from '@medv/finder'

let dataAttribute = null;

module.exports = {
    _findSelector (e) {
        const optimizedMinLength = (e.target.id) ? 2 : 10
        return dataAttribute
            ? finder(e.target, {seedMinLength: 5, optimizedMinLength: optimizedMinLength, attr: (name, _value) => name === dataAttribute})
            : finder(e.target, {seedMinLength: 5, optimizedMinLength: optimizedMinLength})
    }
};
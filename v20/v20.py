from __future__ import print_function, division
import json
from collections import OrderedDict
from jinja2 import Environment, FileSystemLoader

def flatten_tree(tree):
    # flatten properties in json tree
    props = tree["sections"].keys()
    props.remove("fields")
    root = tree["sections"]
    for sect_name, sect in root["fields"].iteritems():
        for prop in props:
            if prop in root.keys() and not prop in sect.keys():
                sect[prop] = root[prop];
        for type_name, type in sect["fields"].iteritems():
            for prop in props:
                if prop in sect.keys() and not prop in type.keys():
                    type[prop] = sect[prop]

with open('data.json', 'r') as f:
    json_txt = f.read()
    data = json.loads(json_txt, object_pairs_hook=OrderedDict)
    # flatten properties to make rendering easier and json non-cluttered
    flatten_tree(data);
    # print, removing all white space
    data['json_txt'] = json.dumps(data, separators=(',',':'))

with open('worker.js', 'r') as f:
    data['worker_js'] = f.read()

jinja_env = Environment(
    loader=FileSystemLoader('.'),
    extensions=['jinja2.ext.do']
)

with open('V20.html', 'w') as f:
    f.write(jinja_env.get_template('V20.jinja').render(d=data))

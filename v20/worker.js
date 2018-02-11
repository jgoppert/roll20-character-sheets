"use strict";
console.log(data);

// change arg lists
function list_changed(l) {
  var out = l.map(x => "change:" + x).join(" ");
  return out;
}

function xpCost(k, new_cost, b, f, xp) {
  var cost = 0;
  if (xp > 0) {
    cost += k * (b + f - 1) * xp + k * xp * (xp + 1) / 2;
    if ((b + f) === 0) {
      cost += new_cost;
    }
  }
  return cost;
}

function attach_field_sum(name, fields, postfix) {
  var deps = Object.keys(fields).map(x => x + "_" + postfix);
  on(list_changed(deps), function(eventInfo) {
    console.log(name, postfix, "deps changed");
    getAttrs(deps, function(v) {
      var d = {};
      var cost = 0;
      for (field in fields) {
        cost += parseInt(v[field + "_" + postfix], 10);
      }
      d[name + "_" + postfix] = cost;
      setAttrs(d);
      console.log(d);
    });
  });
}

// free
var free_deps = Object.keys(data.sections.fields).map(x => x + "_free");
on(list_changed(free_deps), function(eventInfo) {
  console.log("free deps changed");
  getAttrs(free_deps, function(v) {
    var d = {};
    var cost = 0;
    for (name in data.sections.fields) {
      cost += parseInt(v[name + "_free"], 10);
    }
    d["free"] = cost;
    setAttrs(d);
    console.log(d);
  });
});

function attach_property(name) {
  //console.log("attaching property " + name);
  var tot_deps = [
    name + "_base",
    name + "_free",
    name + "_xp"
  ];
  var radio_deps = [
    name + "_radio",
    name
  ];

  // update total if deps change
  on(list_changed(tot_deps) + " sheet:opened", function() {
    console.log(name + " total deps changed");
    getAttrs(tot_deps, function(v) {
      set_d = {};
      var b = parseInt(v[name + "_base"], 10);
      var f = parseInt(v[name + "_free"], 10);
      var xp = parseInt(v[name + "_xp"], 10);
      var tot = b + f + xp;
      console.log("updating total for " + name + ", b:", b, " f:", f, " xp:", xp)
      set_d[name] = tot;
      setAttrs(set_d);
    });
  });

  // update xp, base, free if radio changes
  on("change:" + name + "_radio", function() {
    console.log(name + " radio changed");
    getAttrs([].concat(radio_deps, tot_deps), function(v) {
      set_d = {};
      var b = parseInt(v[name + "_base"], 10);
      var f = parseInt(v[name + "_free"], 10);
      var xp = parseInt(v[name + "_xp"], 10);
      var radio = parseInt(v[name + "_radio"], 10);
      console.log("updating total for " + name + " b:", b, " f:", f, " radio:", radio);
      if (radio < b) {
        b = radio;
        f = 0;
        xp = 0;
      } else if (radio < b + f) {
        f = radio - b;
        xp = 0;
      } else {
        xp = radio - b - f;
      }
      set_d[name + "_base"] = b;
      set_d[name + "_free"] = f;
      set_d[name + "_xp"] = xp;
      setAttrs(set_d);
    });
  });

  // update radio if total changes
  on("change:" + name, function() {
    console.log(name + " total changed");
    getAttrs([].concat(radio_deps, tot_deps), function(v) {
      set_d = {};
      var tot = parseInt(v[name], 10);
      console.log("updating radio for " + name + " tot:", tot);
      set_d[name + "_radio"] = tot;
      setAttrs(set_d);
    });
  });
}

function attach_type(key_type, type) {
  console.log("attaching type", key_type);

  // handle no field case
  if (type.fields === undefined) {
    type.fields = {};
  }

  // properties
  for (var key_prop in type.fields) {
    attach_property(key_prop);
  }

  // base
  var base_deps = Object.keys(type.fields).map(x => x + '_base');
  on(list_changed(base_deps), function() {
    console.log("base_" + key_type + " deps changed");
    getAttrs(base_deps, function(v) {
      var d = {};
      var base = 0;
      for (i in base_deps) {
        base += parseInt(v[base_deps[i]], 10);
      }
      base -= Object.keys(type.fields).length*type.initial_base;
      d[key_type + "_base"] = base;
      setAttrs(d);
      console.log(d);
    });
  });

  // free
  var free_deps = Object.keys(type.fields).map(x => x + '_free');
  on(list_changed(free_deps), function() {
    console.log("free_" + key_type + " deps changed");
    getAttrs(free_deps, function(v) {
      var d = {};
      var cost = 0;
      for (i in free_deps) {
        cost += type.free_cost*parseInt(v[free_deps[i]], 10);
      }
      d[key_type + "_free" ] = cost;
      setAttrs(d);
      console.log(d);
    });
  });

  // xp
  var xp_deps = [].concat(...Object.keys(type.fields).map(x => [x + "_xp", x + "_base", x + "_free"]));
  on(list_changed(xp_deps), function() {
    console.log(key_type + " xp deps changed");
    getAttrs(xp_deps, function(v) {
      var d = {};
      var cost = 0;
      for (name in type.fields) {
        var b = parseInt(v[name + "_base"], 10);
        var f = parseInt(v[name + "_free"], 10);
        var xp = parseInt(v[name + "_xp"], 10);
        cost += xpCost(type.mult_xp_cost, type.new_xp_cost, b, f, xp);
      }
      d[key_type + "_xp"] = cost;
      setAttrs(d);
      console.log(d);
    });
  });
}

function attach_section(name, section) {
  console.log("attaching section", name);

  // handle no field case
  if (section.fields === undefined) {
    section.fields = {};
  }

  for (var key_type in section.fields) {
    var type = section.fields[key_type];
    attach_type(key_type, type);
  }

  // update field sums
  attach_field_sum(name, section.fields, "xp");
  attach_field_sum(name, section.fields, "free");
}

function attach_data(data) {
  console.log("attaching data");

  if (data.sections.fields === undefined) {
    data.sections.fields = {};
  }

  for (var key_sect in data.sections.fields) {
    var sect = data.sections.fields[key_sect];
    attach_section(key_sect, sect);
  }

  // update field sums
  attach_field_sum("total", data.sections.fields, "xp");
  attach_field_sum("total", data.sections.fields, "free");
}

attach_data(data);

on("sheet:opened", function() {
  console.log("sheet opened");
});

/*
on("change:clan", function() {
  console.log("clan change");
  // initialize to clan disciplines
  getAttrs([].concat(discipline_names, ["clan"]), function(v) {
    var d_set = {};
    for (d in discipline_names) {
      var discipline_name = v[discipline_names[d]];
      console.log("discipline name", discipline_names[d], discipline_name);
      if (d < clan_disciplines[v.clan].length) {
        clan_discipline = clan_disciplines[v.clan][d];
        d_set[discipline_names[d]] = clan_discipline;
      }
    }
    setAttrs(d_set);
  });
});
*/

/*
on("change:repeating_disciplines", function(eventInfo) {
  getSectionIDs("repeating_disciplines", function(idArray) {
    var attrs = [].concat(...idArray.map(x => [].concat(
      "repeating_disciplines_" + x + "_base",
      "repeating_disciplines_" + x + "_free",
      "repeating_disciplines_" + x + "_xp")));
    getAttrs(attrs, function(v) {
      console.log(eventInfo);
      var b_tot = 0;
      var f_tot = 0;
      var xp_tot = 0;
      for (x in idArray) {
        id = idArray[x];
        var name = "repeating_disciplines_" + id;
        console.log("getting data for ", name);
        var name_b = name + "_base";
        var name_f = name + "_free";
        var name_xp = name + "_xp";
        var name_dis = name + "_name";
        var b = parseInt(v[name_b], 10);
        var f = parseInt(v[name_f], 10);
        var xp = parseInt(v[name_xp], 10);
        var dis = v[name_dis];
        console.log(dis, " b:", b, " f:", f, " xp:", xp);
        f_tot += f * data.free_cost["discipline"];
        b_tot += b;
        xp_tot += xpCost("discipline", b, f, xp);
      }
      var d = {
        base_discipline: b_tot,
        free_discipline: f_tot,
        xp_discipline: xp_tot
      };
      console.log("setting attrs", d);
      setAttrs(d);
    });
  });
});
*/

// vim: set et fenc=utf-8 ff=unix ft=javascript sts=0 sw=2 ts=2 :
